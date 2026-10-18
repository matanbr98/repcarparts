from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import consistency, maintenance, models, schemas
from ..database import get_db
from ..errors import bad_field
from ..security import get_current_user, get_owned_car
from ..uploads import delete_image

router = APIRouter(tags=["cars"])


def _visible_cars(db: Session, user: models.User):
    q = db.query(models.Car)
    if user.role != "manager":
        q = q.filter(models.Car.user_id == user.id)
    return q


@router.get("/cars", response_model=list[schemas.CarOut])
def list_cars(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _visible_cars(db, user).order_by(models.Car.id.desc()).all()


@router.post("/cars", response_model=schemas.CarOut)
def create_car(car: schemas.CarCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_car = models.Car(**car.model_dump(), user_id=user.id)
    db.add(db_car)
    db.commit()
    db.refresh(db_car)
    return db_car


@router.get("/cars/{car_id}", response_model=schemas.CarOut)
def get_car(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_car(db, user, car_id)


@router.put("/cars/{car_id}", response_model=schemas.CarOut)
def update_car(
    car_id: int,
    payload: schemas.CarUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    car = get_owned_car(db, user, car_id)
    data = payload.model_dump(exclude_unset=True)
    for required in ("nickname", "make", "model"):
        if required in data and data[required] is None:
            data.pop(required)
    for k, v in data.items():
        setattr(car, k, v)
    db.commit()
    db.refresh(car)
    return car


@router.delete("/cars/{car_id}")
def delete_car(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    car = get_owned_car(db, user, car_id)
    urls = [r.image_url for r in car.service_records if r.image_url]
    db.query(models.Reminder).filter(models.Reminder.car_id == car_id).update(
        {models.Reminder.car_id: None}, synchronize_session=False
    )
    db.delete(car)
    db.commit()
    for u in urls:
        delete_image(db, u)
    return {"ok": True}


@router.get("/cars/{car_id}/cost-summary", response_model=schemas.CarCostOut)
def car_cost_summary(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_owned_car(db, user, car_id)
    total = (
        db.query(func.coalesce(func.sum(models.ServiceRecord.cost), 0))
        .filter(models.ServiceRecord.car_id == car_id)
        .scalar()
        or 0
    )
    return {"car_id": car_id, "total_cost": int(total)}


@router.get("/cars/{car_id}/maintenance-due", response_model=list[schemas.MaintenanceDueOut])
def maintenance_due(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    car = get_owned_car(db, user, car_id)
    recs = db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car_id).all()
    return maintenance.compute(recs, manual_km=car.odometer_km)


def _odometer_out(car: models.Car, recs) -> dict:
    record_km = maintenance.current_km(recs)
    effective = maintenance.effective_km(recs, car.odometer_km)
    source = None
    if effective is not None:
        source = "manual" if car.odometer_km is not None and car.odometer_km >= (record_km or 0) else "service"
    return {
        "odometer_km": effective,
        "source": source,
        "manual_km": car.odometer_km,
        "manual_updated_at": car.odometer_updated_at,
        "last_record_km": record_km,
    }


@router.get("/cars/{car_id}/overview", response_model=schemas.CarOverviewOut)
def car_overview(car_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Overall status (with data coverage) and current odometer in one call."""
    car = get_owned_car(db, user, car_id)
    recs = db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car_id).all()
    items = maintenance.compute(recs, manual_km=car.odometer_km)
    status, urgent = maintenance.overall(items)
    return {
        "status": status,
        "coverage": maintenance.coverage(items),
        "most_urgent": urgent,
        "odometer": _odometer_out(car, recs),
        "warnings": consistency.check(recs, car),
    }


@router.put("/cars/{car_id}/odometer", response_model=schemas.OdometerOut)
def set_odometer(
    car_id: int,
    payload: schemas.OdometerIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current odometer without logging a service. It may not go below the highest
    reading already stored on a service record (keeps maintenance calculations consistent)."""
    car = get_owned_car(db, user, car_id)
    recs = db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car_id).all()
    floor = maintenance.current_km(recs)
    if floor is not None and payload.odometer_km < floor:
        top = max((r for r in recs if r.odometer_km is not None), key=lambda r: (r.odometer_km, r.service_date))
        raise bad_field(
            "odometer_km",
            f"Must be at least {floor:,} km: \"{top.title}\" on {top.service_date.strftime('%d %b %Y').lstrip('0')} "
            "records that reading. Correct that service first if it is a typo.",
        )
    before = maintenance.effective_km(recs, car.odometer_km)
    car.odometer_km = payload.odometer_km
    car.odometer_updated_at = date.today()
    db.commit()
    db.refresh(car)
    out = _odometer_out(car, recs)
    warns = [w for w in consistency.check(recs, car) if w["code"] in ("manual_regression", "same_day_mismatch")]
    if before is not None and payload.odometer_km - before >= consistency.LARGE_JUMP_KM:
        warns.append(
            {
                "code": "large_jump",
                "message": f"That is {payload.odometer_km - before:,} km more than the last known reading "
                f"({before:,} km). Make sure it is correct - mileage-based reminders will use it.",
                "record_ids": [],
            }
        )
    out["warnings"] = warns
    return out


@router.get("/cars/{car_id}/expenses", response_model=schemas.ExpensesOut)
def car_expenses(
    car_id: int,
    year: int | None = Query(None, ge=1900, le=2200),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_car(db, user, car_id)
    recs = db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car_id).all()
    total = sum(int(r.cost or 0) for r in recs)
    ref_year = year or date.today().year
    year_total = sum(int(r.cost or 0) for r in recs if r.service_date.year == ref_year)
    scoped = [r for r in recs if year is None or r.service_date.year == year]

    types: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    months: dict[str, int] = defaultdict(int)
    for r in scoped:
        key = maintenance.category(r)
        types[key][0] += int(r.cost or 0)
        types[key][1] += 1
        months[r.service_date.strftime("%Y-%m")] += int(r.cost or 0)
    by_type = [
        {"treatment_type": k, "label": maintenance.label_for(k), "total": v[0], "count": v[1]}
        for k, v in sorted(types.items(), key=lambda kv: (-kv[1][0], kv[0]))
    ]
    by_month = [{"month": m, "total": t} for m, t in sorted(months.items())]
    return {
        "total": total,
        "year_total": year_total,
        "records_count": len(scoped),
        "by_type": by_type,
        "by_month": by_month,
    }


@router.get("/garage", response_model=schemas.GarageOut)
def garage(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cars = _visible_cars(db, user).order_by(models.Car.id.desc()).all()
    ids = [c.id for c in cars]
    by_car: dict[int, list] = defaultdict(list)
    if ids:
        for r in db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id.in_(ids)).all():
            by_car[r.car_id].append(r)

    this_year = date.today().year
    services_year = spend_year = spend_total = 0
    out = []
    for c in cars:
        recs = by_car.get(c.id, [])
        total = sum(int(r.cost or 0) for r in recs)
        spend_total += total
        for r in recs:
            if r.service_date.year == this_year:
                services_year += 1
                spend_year += int(r.cost or 0)
        items = maintenance.compute(recs, manual_km=c.odometer_km)
        status, urgent = maintenance.overall(items)
        out.append(
            {
                "id": c.id,
                "user_id": c.user_id,
                "nickname": c.nickname,
                "make": c.make,
                "model": c.model,
                "year": c.year,
                "license_plate": c.license_plate,
                "odometer_km": maintenance.effective_km(recs, c.odometer_km),
                "coverage": maintenance.coverage(items),
                "last_service_date": max((r.service_date for r in recs if r.service_date <= date.today()), default=None),
                "total_cost": total,
                "records_count": len(recs),
                "status": status,
                "most_urgent": urgent,
            }
        )
    return {
        "summary": {
            "cars": len(cars),
            "services_this_year": services_year,
            "spend_this_year": spend_year,
            "spend_total": spend_total,
        },
        "cars": out,
    }
