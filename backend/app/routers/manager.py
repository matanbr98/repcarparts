from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..errors import ApiError, bad_field
from ..security import require_manager
from ..uploads import save_image
from ._util import parse_date

router = APIRouter(prefix="/manager", tags=["manager"])


@router.get("/users", response_model=list[schemas.UserOut])
def manager_list_users(_: models.User = Depends(require_manager), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.id.desc()).all()


@router.get("/stats", response_model=schemas.StatsOut)
def manager_stats(_: models.User = Depends(require_manager), db: Session = Depends(get_db)):
    users = db.query(func.count(models.User.id)).scalar() or 0
    cars = db.query(func.count(models.Car.id)).scalar() or 0
    records = db.query(func.count(models.ServiceRecord.id)).scalar() or 0
    total_cost = db.query(func.coalesce(func.sum(models.ServiceRecord.cost), 0)).scalar() or 0
    return {"users": users, "cars": cars, "records": records, "total_cost": int(total_cost)}


@router.get("/parts-averages", response_model=list[schemas.PartAverageOut])
def manager_parts_averages(_: models.User = Depends(require_manager), db: Session = Depends(get_db)):
    rows = db.query(
        models.ServiceRecord.treatment_type, models.ServiceRecord.parts_replaced, models.ServiceRecord.cost
    ).all()
    sums: dict[str, int] = defaultdict(int)
    counts: dict[str, int] = defaultdict(int)
    for ttype, parts, cost in rows:
        cost_val = int(cost or 0)
        ttype = (ttype or "").strip()
        if ttype:
            keys = [ttype.lower()]
        else:
            keys = [p.strip().lower() for p in (parts or "").split(",") if p.strip()]
        for k in keys:
            sums[k] += cost_val
            counts[k] += 1
    out = [{"part": k, "avg_cost": sums[k] / counts[k], "count": counts[k]} for k in sums]
    out.sort(key=lambda x: (-x["count"], x["part"]))
    return out


@router.post("/reminders", response_model=list[schemas.ReminderOut], status_code=201)
async def manager_create_reminder(
    title: str = Form(..., min_length=1, max_length=120),
    message: str = Form(..., min_length=1, max_length=2000),
    broadcast_all_users: bool = Form(False),
    target_user_id: int | None = Form(None),
    target_car_id: int | None = Form(None),
    due_date: str | None = Form(None),
    image: UploadFile | None = File(None),
    manager: models.User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    parsed_due = parse_date(due_date, "due_date")

    recipients: list[models.User]
    car_id = None
    if broadcast_all_users:
        recipients = db.query(models.User).filter(models.User.role != "manager").all()
        if not recipients:
            raise ApiError(400, "No users to send to (create a user account first)")
    else:
        if not target_user_id:
            raise bad_field("target_user_id", "target_user_id required unless broadcast_all_users=true", 400)
        u = db.query(models.User).filter(models.User.id == target_user_id).first()
        if not u:
            raise ApiError(404, "User not found")
        recipients = [u]
        if target_car_id is not None:
            car = db.query(models.Car).filter(models.Car.id == target_car_id).first()
            if not car or car.user_id != u.id:
                raise bad_field("target_car_id", "Car does not belong to the target user")
            car_id = car.id

    img_url = None
    if image is not None and image.filename:
        img_url = await save_image(image)

    created = date.today()
    out = []
    for u in recipients:
        r = models.Reminder(
            created_by_user_id=manager.id,
            user_id=u.id,
            car_id=car_id,
            title=title.strip(),
            message=message,
            due_date=parsed_due,
            created_at=created,
            image_url=img_url,
            source="manager",
            done=False,
        )
        db.add(r)
        out.append(r)
    db.commit()
    for r in out:
        db.refresh(r)
    return out
