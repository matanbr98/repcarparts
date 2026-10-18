import csv
import io
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import extract, or_
from sqlalchemy.orm import Session

from .. import consistency, models, schemas
from ..database import get_db
from ..errors import ApiError, bad_field
from ..security import get_current_user, get_owned_car
from ..uploads import delete_image, save_image
from ._util import parse_date

router = APIRouter(tags=["records"])


def _filtered(db: Session, car_id: int, q, type_, year, date_from, date_to):
    df = parse_date(date_from, "date_from")
    dt = parse_date(date_to, "date_to")
    query = db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car_id)
    if q and q.strip():
        needle = q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{needle}%"
        query = query.filter(
            or_(
                models.ServiceRecord.title.ilike(like, escape="\\"),
                models.ServiceRecord.notes.ilike(like, escape="\\"),
                models.ServiceRecord.parts_replaced.ilike(like, escape="\\"),
            )
        )
    if type_:
        query = query.filter(models.ServiceRecord.treatment_type == type_)
    if year is not None:
        query = query.filter(extract("year", models.ServiceRecord.service_date) == year)
    if df:
        query = query.filter(models.ServiceRecord.service_date >= df)
    if dt:
        query = query.filter(models.ServiceRecord.service_date <= dt)
    return query.order_by(models.ServiceRecord.service_date.desc(), models.ServiceRecord.id.desc())


@router.get("/cars/{car_id}/records", response_model=list[schemas.ServiceRecordOut])
def list_records(
    car_id: int,
    q: str | None = Query(None, max_length=100),
    type: str | None = Query(None, max_length=60),
    year: int | None = Query(None, ge=1900, le=2200),
    date_from: str | None = None,
    date_to: str | None = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_car(db, user, car_id)
    return _filtered(db, car_id, q, type, year, date_from, date_to).all()


def _csv_cell(v):
    s = "" if v is None else str(v)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        s = "'" + s  # neutralise spreadsheet formula injection
    return s


def _csv_disposition(car, car_id: int) -> str:
    """ASCII fallback plus an RFC 5987 UTF-8 name so non-ASCII vehicle names survive."""
    ascii_name = f"car-{car_id}-records.csv"
    label = (car.nickname or car.license_plate or "").strip()
    safe = "".join(ch if (ch.isalnum() or ch in "-_. ") else "_" for ch in label).strip(" ._")
    if not safe or not any(ch.isalnum() for ch in safe):
        return f'attachment; filename="{ascii_name}"'
    utf8 = quote(f"{safe}-service-history.csv", safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8}"


@router.get("/cars/{car_id}/records.csv")
def records_csv(
    car_id: int,
    q: str | None = Query(None, max_length=100),
    type: str | None = Query(None, max_length=60),
    year: int | None = Query(None, ge=1900, le=2200),
    date_from: str | None = None,
    date_to: str | None = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    car = get_owned_car(db, user, car_id)
    rows = _filtered(db, car_id, q, type, year, date_from, date_to).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "title", "treatment_type", "odometer_km", "cost", "parts_replaced", "notes"])
    for r in rows:
        w.writerow(
            [
                r.service_date.isoformat(),
                _csv_cell(r.title),
                _csv_cell(r.treatment_type),
                r.odometer_km if r.odometer_km is not None else "",
                r.cost if r.cost is not None else 0,
                _csv_cell(r.parts_replaced),
                _csv_cell(r.notes),
            ]
        )
    body = ("﻿" + buf.getvalue()).encode("utf-8")
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": _csv_disposition(car, car_id)},
    )


def _get_record(db: Session, car_id: int, record_id: int) -> models.ServiceRecord:
    rec = (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.car_id == car_id, models.ServiceRecord.id == record_id)
        .first()
    )
    if not rec:
        raise ApiError(404, "Record not found")
    return rec


def _with_warnings(db: Session, car: models.Car, rec: models.ServiceRecord) -> schemas.ServiceRecordOut:
    """Serialise a record together with non-blocking consistency hints that involve it."""
    recs = db.query(models.ServiceRecord).filter(models.ServiceRecord.car_id == car.id).all()
    out = schemas.ServiceRecordOut.model_validate(rec)
    out.warnings = [schemas.ConsistencyWarning(**w) for w in consistency.for_record(consistency.check(recs, car), rec.id)]
    return out


@router.put("/cars/{car_id}/records/{record_id}", response_model=schemas.ServiceRecordOut)
def update_record(
    car_id: int,
    record_id: int,
    payload: schemas.ServiceRecordUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    car = get_owned_car(db, user, car_id)
    rec = _get_record(db, car_id, record_id)
    data = payload.model_dump(exclude_unset=True)
    for required in ("service_date", "title"):
        if required in data and data[required] is None:
            data.pop(required)
    if "cost" in data and data["cost"] is None:
        data["cost"] = 0  # a missing cost is zero, never NULL
    for k, v in data.items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    return _with_warnings(db, car, rec)


@router.delete("/cars/{car_id}/records/{record_id}")
def delete_record(
    car_id: int, record_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    get_owned_car(db, user, car_id)
    rec = _get_record(db, car_id, record_id)
    url = rec.image_url
    db.delete(rec)
    db.commit()
    delete_image(db, url)
    return {"ok": True}


@router.put("/cars/{car_id}/records/{record_id}/image", response_model=schemas.ServiceRecordOut)
async def replace_receipt(
    car_id: int,
    record_id: int,
    image: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_car(db, user, car_id)
    rec = _get_record(db, car_id, record_id)
    new_url = await save_image(image)
    old = rec.image_url
    rec.image_url = new_url
    db.commit()
    db.refresh(rec)
    delete_image(db, old)
    return rec


@router.delete("/cars/{car_id}/records/{record_id}/image", response_model=schemas.ServiceRecordOut)
def remove_receipt(
    car_id: int, record_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    get_owned_car(db, user, car_id)
    rec = _get_record(db, car_id, record_id)
    old = rec.image_url
    rec.image_url = None
    db.commit()
    db.refresh(rec)
    delete_image(db, old)
    return rec


@router.post("/cars/{car_id}/records", response_model=schemas.ServiceRecordOut)
async def add_record(
    car_id: int,
    title: str = Form(..., max_length=120),
    service_date: str = Form(...),
    odometer_km: int | None = Form(None, ge=0, le=schemas.MAX_KM),
    parts_replaced: str | None = Form(None, max_length=255),
    treatment_type: str | None = Form(None),
    position: str | None = Form(None, max_length=30),
    tire_position: str | None = Form(None, max_length=30),
    tires_count: int | None = Form(None, ge=0, le=20),
    cost: int = Form(0, ge=0, le=schemas.MAX_COST),
    notes: str | None = Form(None, max_length=5000),
    image: UploadFile | None = File(None),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    car = get_owned_car(db, user, car_id)
    clean_title = (title or "").strip()
    if not clean_title:
        raise bad_field("title", "Title is required.")
    parsed = parse_date(service_date, "service_date", required=True, bounds=True)
    try:
        ttype = schemas.validate_treatment_type(treatment_type)
    except ValueError as e:
        raise bad_field("treatment_type", str(e))

    image_url = None
    if image is not None and image.filename:
        image_url = await save_image(image)

    rec = models.ServiceRecord(
        car_id=car_id,
        title=clean_title,
        service_date=parsed,
        odometer_km=odometer_km,
        parts_replaced=parts_replaced,
        treatment_type=ttype,
        position=position,
        tire_position=tire_position,
        tires_count=tires_count,
        cost=cost,
        notes=notes,
        image_url=image_url,
        created_at=date.today(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _with_warnings(db, car, rec)
