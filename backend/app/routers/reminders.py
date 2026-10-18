from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..errors import ApiError, bad_field
from ..security import get_current_user

router = APIRouter(tags=["reminders"])


def _own(db: Session, user: models.User, rid: int) -> models.Reminder:
    r = db.query(models.Reminder).filter(models.Reminder.id == rid, models.Reminder.user_id == user.id).first()
    if not r:
        raise ApiError(404, "Reminder not found")
    return r


@router.get("/me/reminders", response_model=list[schemas.ReminderOut])
def my_reminders(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(models.Reminder)
        .filter(models.Reminder.user_id == user.id)
        .order_by(models.Reminder.id.desc())
        .all()
    )


@router.post("/me/reminders", response_model=schemas.ReminderOut, status_code=201)
def create_self_reminder(
    payload: schemas.SelfReminderCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.car_id is not None:
        car = db.query(models.Car).filter(models.Car.id == payload.car_id).first()
        if not car or car.user_id != user.id:
            raise bad_field("car_id", "Car not found", 404)
    r = models.Reminder(
        created_by_user_id=user.id,
        user_id=user.id,
        car_id=payload.car_id,
        title=payload.title.strip(),
        message=(payload.message or "").strip(),
        due_date=payload.due_date,
        created_at=date.today(),
        source="self",
        done=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.patch("/me/reminders/{reminder_id}", response_model=schemas.ReminderOut)
def patch_reminder(
    reminder_id: int,
    payload: schemas.ReminderPatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    r = _own(db, user, reminder_id)
    r.done = payload.done
    r.done_at = date.today() if payload.done else None
    db.commit()
    db.refresh(r)
    return r


@router.delete("/me/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    r = _own(db, user, reminder_id)
    if (r.source or "manager") != "self":
        raise ApiError(403, "Only your own reminders can be deleted")
    db.delete(r)
    db.commit()
    return {"ok": True}
