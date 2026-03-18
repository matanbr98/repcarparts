from __future__ import annotations

import os
import shutil
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
import sqlite3

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import Base, engine, get_db
from . import models, schemas

Base.metadata.create_all(bind=engine)


def _ensure_sqlite_schema():
    # `create_all()` doesn't modify existing tables. This keeps local SQLite DBs working
    # after adding new columns during development.
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(service_records)")).fetchall()
        if cols:
            col_names = {row[1] for row in cols}  # row[1] = name
            if "image_url" not in col_names:
                conn.execute(text("ALTER TABLE service_records ADD COLUMN image_url VARCHAR(255)"))
            if "treatment_type" not in col_names:
                conn.execute(text("ALTER TABLE service_records ADD COLUMN treatment_type VARCHAR(60)"))
            if "position" not in col_names:
                conn.execute(text("ALTER TABLE service_records ADD COLUMN position VARCHAR(30)"))
            if "tire_position" not in col_names:
                conn.execute(text("ALTER TABLE service_records ADD COLUMN tire_position VARCHAR(30)"))
            if "tires_count" not in col_names:
                conn.execute(text("ALTER TABLE service_records ADD COLUMN tires_count INTEGER"))

        car_cols = conn.execute(text("PRAGMA table_info(cars)")).fetchall()
        if car_cols:
            car_col_names = {row[1] for row in car_cols}
            if "user_id" not in car_col_names:
                conn.execute(text("ALTER TABLE cars ADD COLUMN user_id INTEGER"))

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    username VARCHAR(80) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    name VARCHAR(120),
                    phone VARCHAR(40),
                    email VARCHAR(120)
                )
                """
            )
        )

        # Add missing columns for older DBs
        user_cols = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        if user_cols:
            user_col_names = {row[1] for row in user_cols}
            if "name" not in user_col_names:
                conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR(120)"))
            if "phone" not in user_col_names:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(40)"))
            if "email" not in user_col_names:
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(120)"))
            if "profile_image_url" not in user_col_names:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(255)"))

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY,
                    created_by_user_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    car_id INTEGER,
                    title VARCHAR(120) NOT NULL,
                    message TEXT NOT NULL,
                    due_date DATE,
                    created_at DATE NOT NULL,
                    image_url VARCHAR(255),
                    FOREIGN KEY(created_by_user_id) REFERENCES users(id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(car_id) REFERENCES cars(id)
                )
                """
            )
        )


_ensure_sqlite_schema()


def _import_users_from_legacy_db():
    """
    If the backend previously ran from the repo root, it may have created a second
    `repcarparts.db` one level above `backend/`. This imports missing users so login works.
    """
    legacy_path = (Path(__file__).resolve().parent.parent.parent / "repcarparts.db").resolve()
    current_path = (Path(__file__).resolve().parent.parent / "repcarparts.db").resolve()
    if legacy_path == current_path or not legacy_path.exists():
        return

    try:
        src = sqlite3.connect(str(legacy_path))
        cur = src.cursor()
        cur.execute("select name from sqlite_master where type='table' and name='users'")
        if not cur.fetchone():
            src.close()
            return
        cur.execute(
            "select username, password_hash, role, name, phone, email, profile_image_url from users"
        )
        rows = cur.fetchall()
        src.close()
    except Exception:
        return

    if not rows:
        return

    with Session(engine) as db:
        for (username, password_hash, role, name, phone, email, profile_image_url) in rows:
            exists = db.query(models.User).filter(models.User.username == username).first()
            if exists:
                continue
            u = models.User(
                username=username,
                password_hash=password_hash,
                role=role,
                name=name,
                phone=phone,
                email=email,
                profile_image_url=profile_image_url,
            )
            db.add(u)
        db.commit()


_import_users_from_legacy_db()

UPLOAD_DIR = (Path(__file__).resolve().parent.parent / "uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="repcarparts API")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "name": "repcarparts API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"ok": True}


JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRES_MIN = 60 * 24 * 7  # 7 days
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _create_access_token(*, user_id: int, role: str) -> str:
    # Keep payload minimal
    payload = {"sub": str(user_id), "role": role}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> models.User:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_manager(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager only")
    return user


def _ensure_default_manager():
    with Session(engine) as db:
        mgr = db.query(models.User).filter(models.User.username == "aa").first()
        if not mgr:
            mgr = models.User(username="aa", password_hash=_hash_password("aa"), role="manager")
            db.add(mgr)
            db.commit()
            db.refresh(mgr)

        # Backfill existing cars to manager if they have no user_id
        try:
            db.query(models.Car).filter(models.Car.user_id.is_(None)).update({models.Car.user_id: mgr.id})
            db.commit()
        except Exception:
            db.rollback()


_ensure_default_manager()


@app.post("/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad username or password")

    token = _create_access_token(user_id=user.id, role=user.role)
    return {"access_token": token, "token_type": "bearer", "role": user.role}


@app.post("/auth/register", response_model=schemas.UserOut, status_code=201)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=409, detail="Username already exists")

    user = models.User(
        username=payload.username,
        password_hash=_hash_password(payload.password),
        role="user",
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@app.put("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UpdateProfileRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@app.put("/me/password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = _hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@app.post("/me/profile-picture", response_model=schemas.UserOut)
async def upload_profile_picture(
    image: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    safe_name = f"profile_{user.id}_{Path(image.filename).name}"
    disk_path = (UPLOAD_DIR / safe_name).resolve()
    with open(disk_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    user.profile_image_url = f"uploads/{safe_name}"
    db.commit()
    db.refresh(user)
    return user


@app.get("/manager/users", response_model=list[schemas.UserOut])
def manager_list_users(_: models.User = Depends(require_manager), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.id.desc()).all()


@app.get("/manager/stats", response_model=schemas.StatsOut)
def manager_stats(_: models.User = Depends(require_manager), db: Session = Depends(get_db)):
    users = db.query(func.count(models.User.id)).scalar() or 0
    cars = db.query(func.count(models.Car.id)).scalar() or 0
    records = db.query(func.count(models.ServiceRecord.id)).scalar() or 0
    total_cost = db.query(func.coalesce(func.sum(models.ServiceRecord.cost), 0)).scalar() or 0
    return {"users": users, "cars": cars, "records": records, "total_cost": int(total_cost)}


@app.get("/manager/parts-averages", response_model=list[schemas.PartAverageOut])
def manager_parts_averages(_: models.User = Depends(require_manager), db: Session = Depends(get_db)):
    rows = db.query(models.ServiceRecord.parts_replaced, models.ServiceRecord.cost).all()
    sums: dict[str, int] = defaultdict(int)
    counts: dict[str, int] = defaultdict(int)

    for parts, cost in rows:
        if not parts:
            continue
        cost_val = int(cost or 0)
        for raw in parts.split(","):
            part = raw.strip().lower()
            if not part:
                continue
            sums[part] += cost_val
            counts[part] += 1

    out = []
    for part, total in sums.items():
        c = counts[part]
        out.append({"part": part, "avg_cost": (total / c) if c else 0.0, "count": c})

    out.sort(key=lambda x: (-x["count"], x["part"]))
    return out


@app.get("/me/cost-summary", response_model=schemas.UserCostSummaryOut)
def my_cost_summary(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # total per car
    q = (
        db.query(models.Car.id, func.coalesce(func.sum(models.ServiceRecord.cost), 0))
        .join(models.ServiceRecord, models.ServiceRecord.car_id == models.Car.id, isouter=True)
        .filter(models.Car.user_id == user.id)
        .group_by(models.Car.id)
        .all()
    )
    by_car = [{"car_id": int(car_id), "total_cost": int(total or 0)} for car_id, total in q]
    total_cost = sum(x["total_cost"] for x in by_car)
    return {"total_cost": int(total_cost), "by_car": by_car}


@app.get("/cars/{car_id}/cost-summary", response_model=schemas.CarCostOut)
def car_cost_summary(
    car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    total = (
        db.query(func.coalesce(func.sum(models.ServiceRecord.cost), 0))
        .filter(models.ServiceRecord.car_id == car_id)
        .scalar()
        or 0
    )
    return {"car_id": car_id, "total_cost": int(total)}


MAINTENANCE_INTERVAL_DAYS = {
    "engine oil": 180,
    "oil": 180,
    "oil filter": 180,
    "air filter": 365,
    "cabin filter": 365,
    "brake pads": 730,
    "brakes": 730,
    "tires": 1095,
    "battery": 1095,
    "spark plugs": 1460,
}


@app.get("/cars/{car_id}/maintenance-due", response_model=list[schemas.MaintenanceDueOut])
def maintenance_due(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # build last service date per known part from records
    records = (
        db.query(models.ServiceRecord.service_date, models.ServiceRecord.title, models.ServiceRecord.parts_replaced)
        .filter(models.ServiceRecord.car_id == car_id)
        .order_by(models.ServiceRecord.service_date.desc())
        .all()
    )

    last: dict[str, date] = {}
    for svc_date, title, parts in records:
        text_blob = " ".join([title or "", parts or ""]).lower()
        for part in MAINTENANCE_INTERVAL_DAYS.keys():
            if part in text_blob and part not in last:
                last[part] = svc_date

    out = []
    today = date.today()
    for part, interval in MAINTENANCE_INTERVAL_DAYS.items():
        last_date = last.get(part)
        if not last_date:
            out.append({"part": part, "last_service_date": None, "due_date": None, "status": "unknown"})
            continue
        due = last_date + timedelta(days=interval)
        if due < today:
            status_s = "overdue"
        elif due <= (today + timedelta(days=21)):
            status_s = "due_soon"
        else:
            status_s = "ok"
        out.append({"part": part, "last_service_date": last_date, "due_date": due, "status": status_s})

    return out


@app.get("/me/reminders", response_model=list[schemas.ReminderOut])
def my_reminders(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(models.Reminder)
        .filter(models.Reminder.user_id == user.id)
        .order_by(models.Reminder.id.desc())
        .all()
    )


@app.post("/manager/reminders", response_model=list[schemas.ReminderOut], status_code=201)
async def manager_create_reminder(
    title: str = Form(...),
    message: str = Form(...),
    broadcast_all_users: bool = Form(False),
    target_user_id: int | None = Form(None),
    target_car_id: int | None = Form(None),
    due_date: str | None = Form(None),  # YYYY-MM-DD optional
    image: UploadFile | None = File(None),
    manager: models.User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    img_url = None
    if image:
        safe_name = f"reminder_{manager.id}_{Path(image.filename).name}"
        disk_path = (UPLOAD_DIR / safe_name).resolve()
        with open(disk_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        img_url = f"uploads/{safe_name}"

    parsed_due = date.fromisoformat(due_date) if due_date else None
    created = date.today()

    recipients: list[models.User] = []
    if broadcast_all_users:
        recipients = db.query(models.User).filter(models.User.role != "manager").all()
        if not recipients:
            raise HTTPException(status_code=400, detail="No users to send to (create a user account first)")
    else:
        if not target_user_id:
            raise HTTPException(status_code=400, detail="target_user_id required unless broadcast_all_users=true")
        u = db.query(models.User).filter(models.User.id == target_user_id).first()
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        recipients = [u]

    out = []
    for u in recipients:
        r = models.Reminder(
            created_by_user_id=manager.id,
            user_id=u.id,
            car_id=target_car_id,
            title=title,
            message=message,
            due_date=parsed_due,
            created_at=created,
            image_url=img_url,
        )
        db.add(r)
        out.append(r)

    db.commit()
    for r in out:
        db.refresh(r)
    return out


@app.get("/cars", response_model=list[schemas.CarOut])
def list_cars(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "manager":
        return db.query(models.Car).order_by(models.Car.id.desc()).all()
    return db.query(models.Car).filter(models.Car.user_id == user.id).order_by(models.Car.id.desc()).all()

@app.post("/cars", response_model=schemas.CarOut)
def create_car(car: schemas.CarCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_car = models.Car(**car.model_dump(), user_id=user.id)
    db.add(db_car)
    db.commit()
    db.refresh(db_car)
    return db_car

@app.get("/cars/{car_id}/records", response_model=list[schemas.ServiceRecordOut])
def list_records(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car_id).all()


@app.put("/cars/{car_id}/records/{record_id}", response_model=schemas.ServiceRecordOut)
def update_record(
    car_id: int,
    record_id: int,
    payload: schemas.ServiceRecordUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    rec = (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.car_id == car_id, models.ServiceRecord.id == record_id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)
    return rec


@app.delete("/cars/{car_id}/records/{record_id}")
def delete_record(car_id: int, record_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    rec = (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.car_id == car_id, models.ServiceRecord.id == record_id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")

    # Best-effort: delete stored image file
    if rec.image_url:
        try:
            disk_path = (Path(__file__).resolve().parent.parent / rec.image_url).resolve()
            if disk_path.exists() and disk_path.is_file():
                disk_path.unlink()
        except Exception:
            pass

    db.delete(rec)
    db.commit()
    return {"ok": True}


@app.delete("/cars/{car_id}")
def delete_car(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Best-effort: delete images for this car
    try:
        for rec in list(car.service_records or []):
            if rec.image_url:
                disk_path = (Path(__file__).resolve().parent.parent / rec.image_url).resolve()
                if disk_path.exists() and disk_path.is_file():
                    disk_path.unlink()
    except Exception:
        pass

    db.delete(car)
    db.commit()
    return {"ok": True}


@app.post("/cars/{car_id}/records", response_model=schemas.ServiceRecordOut)
async def add_record(
    car_id: int,
    title: str = Form(...),
    service_date: str = Form(...),  # YYYY-MM-DD
    odometer_km: int | None = Form(None),
    parts_replaced: str | None = Form(None),
    treatment_type: str | None = Form(None),
    position: str | None = Form(None),
    tire_position: str | None = Form(None),
    tires_count: int | None = Form(None),
    cost: int = Form(0),
    notes: str | None = Form(None),
    image: UploadFile | None = File(None),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    image_url = None
    if image:
        safe_name = f"{car_id}_{Path(image.filename).name}"
        disk_path = (UPLOAD_DIR / safe_name).resolve()
        with open(disk_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"uploads/{safe_name}"

    db_record = models.ServiceRecord(
        car_id=car_id,
        title=title,
        service_date=date.fromisoformat(service_date),
        odometer_km=odometer_km,
        parts_replaced=parts_replaced,
        treatment_type=treatment_type,
        position=position,
        tire_position=tire_position,
        tires_count=tires_count,
        cost=cost,
        notes=notes,
        image_url=image_url,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record