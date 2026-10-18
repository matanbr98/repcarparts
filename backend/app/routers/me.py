from datetime import date

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..errors import ApiError
from ..security import create_access_token, get_current_user, hash_password, verify_password
from ..uploads import delete_image, save_image

router = APIRouter(tags=["me"])


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UpdateProfileRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise ApiError(400, "Current password is incorrect", {"current_password": "Current password is incorrect"})
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.pwd_version = int(user.pwd_version or 0) + 1
    db.commit()
    # Old tokens are now invalid; a fresh token is returned so the caller stays signed in.
    return {"ok": True, "access_token": create_access_token(user), "token_type": "bearer"}


@router.post("/me/profile-picture", response_model=schemas.UserOut)
async def upload_profile_picture(
    image: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_url = await save_image(image)
    old = user.profile_image_url
    user.profile_image_url = new_url
    db.commit()
    db.refresh(user)
    if old and old != new_url:
        delete_image(db, old)
    return user


@router.get("/me/cost-summary", response_model=schemas.UserCostSummaryOut)
def my_cost_summary(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = (
        db.query(models.Car.id, func.coalesce(func.sum(models.ServiceRecord.cost), 0))
        .join(models.ServiceRecord, models.ServiceRecord.car_id == models.Car.id, isouter=True)
        .filter(models.Car.user_id == user.id)
        .group_by(models.Car.id)
        .all()
    )
    by_car = [{"car_id": int(cid), "total_cost": int(total or 0)} for cid, total in q]
    return {"total_cost": sum(x["total_cost"] for x in by_car), "by_car": by_car}
