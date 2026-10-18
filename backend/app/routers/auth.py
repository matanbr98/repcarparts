from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..errors import ApiError
from ..security import (
    LOGIN_LIMIT,
    LOGIN_WINDOW,
    REGISTER_LIMIT,
    REGISTER_WINDOW,
    burn_verify,
    check_limit,
    client_ip,
    create_access_token,
    hash_password,
    limiter,
    verify_password,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    uname = payload.username.strip().lower()
    keys = (f"login:ip:{ip}", f"login:user:{ip}:{uname}")
    for k in keys:
        check_limit(k, LOGIN_LIMIT, LOGIN_WINDOW)

    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if user is None:
        # tolerate a different letter case when it identifies exactly one account
        ci = db.query(models.User).filter(func.lower(models.User.username) == payload.username.lower()).all()
        if len(ci) == 1:
            user = ci[0]
    if user is None:
        burn_verify(payload.password)
        ok = False
    else:
        ok = verify_password(payload.password, user.password_hash)
    if not ok:
        for k in keys:
            limiter.hit(k, LOGIN_WINDOW)
        raise ApiError(401, "Bad username or password")

    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "role": user.role,
        "must_change_password": bool(user.must_change_password),
    }


@router.post("/auth/register", response_model=schemas.UserOut, status_code=201)
def register(payload: schemas.RegisterRequest, request: Request, db: Session = Depends(get_db)):
    key = f"register:ip:{client_ip(request)}"
    check_limit(key, REGISTER_LIMIT, REGISTER_WINDOW)
    limiter.hit(key, REGISTER_WINDOW)

    exists = db.query(models.User).filter(func.lower(models.User.username) == payload.username.lower()).first()
    if exists:
        raise ApiError(409, "That username is already taken (usernames are not case-sensitive).")
    user = models.User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role="user",
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        must_change_password=False,
        pwd_version=0,
        created_at=date.today(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
