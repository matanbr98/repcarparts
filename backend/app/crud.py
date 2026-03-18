from __future__ import annotations

from sqlalchemy.orm import Session

from . import models, schemas


def create_car(db: Session, payload: schemas.CarCreate) -> models.Car:
    car = models.Car(**payload.model_dump())
    db.add(car)
    db.commit()
    db.refresh(car)
    return car


def list_cars(db: Session) -> list[models.Car]:
    return db.query(models.Car).order_by(models.Car.id.desc()).all()


def get_car(db: Session, car_id: int) -> models.Car | None:
    return db.query(models.Car).filter(models.Car.id == car_id).first()


def add_service_record(
    db: Session, *, car_id: int, payload: schemas.ServiceRecordCreate
) -> models.ServiceRecord:
    rec = models.ServiceRecord(car_id=car_id, **payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def list_service_records(db: Session, *, car_id: int) -> list[models.ServiceRecord]:
    return (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.car_id == car_id)
        .order_by(models.ServiceRecord.service_date.desc(), models.ServiceRecord.id.desc())
        .all()
    )

