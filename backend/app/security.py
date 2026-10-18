"""Password hashing, JWT, auth dependencies and a per-process rate limiter."""
from __future__ import annotations

import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .database import get_db
from .errors import ApiError

JWT_ALG = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

LOCKED_PREFIX = "!locked$"
_DUMMY_HASH = pwd_context.hash(secrets.token_hex(8))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash or password_hash.startswith(LOCKED_PREFIX):
        return False
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def burn_verify(password: str) -> None:
    """Equalise work for unknown usernames (timing side channel)."""
    try:
        pwd_context.verify(password, _DUMMY_HASH)
    except Exception:
        pass


def unusable_hash() -> str:
    return LOCKED_PREFIX + secrets.token_hex(32)


def is_locked_hash(password_hash: str | None) -> bool:
    return bool(password_hash) and password_hash.startswith(LOCKED_PREFIX)


def create_access_token(user: models.User) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "pwd_v": int(user.pwd_version or 0),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=s.access_token_minutes)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=JWT_ALG)


def _unauthorized(msg: str = "Invalid or expired token") -> ApiError:
    return ApiError(401, msg, headers={"WWW-Authenticate": "Bearer"})


# The only calls a user with a pending forced password change may make.
_PASSWORD_CHANGE_ALLOWED = {("GET", "/me"), ("PUT", "/me/password")}


def get_current_user(
    request: Request, db: Session = Depends(get_db), token: str | None = Depends(oauth2_scheme)
) -> models.User:
    if not token:
        raise _unauthorized("Not authenticated")
    try:
        payload = jwt.decode(
            token, get_settings().jwt_secret, algorithms=[JWT_ALG], options={"require_exp": True, "require_iat": True}
        )
        user_id = int(payload.get("sub"))
        pwd_v = int(payload.get("pwd_v"))
    except (JWTError, TypeError, ValueError):
        raise _unauthorized()
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise _unauthorized("User not found")
    if pwd_v != int(user.pwd_version or 0):
        raise _unauthorized()
    if user.must_change_password and (request.method, request.url.path) not in _PASSWORD_CHANGE_ALLOWED:
        raise ApiError(
            403,
            "You must set a new password before continuing.",
            code="password_change_required",
        )
    return user


def require_manager(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "manager":
        raise ApiError(403, "Manager only")
    return user


def get_owned_car(db: Session, user: models.User, car_id: int) -> models.Car:
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not car:
        raise ApiError(404, "Car not found")
    if user.role != "manager" and car.user_id != user.id:
        raise ApiError(403, "Forbidden")
    return car


# ---- rate limiter (in-memory, per process) ----
class RateLimiter:
    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, window: float, now: float) -> deque:
        q = self._hits[key]
        while q and q[0] <= now - window:
            q.popleft()
        return q

    def blocked(self, key: str, limit: int, window: float) -> int:
        """Seconds to wait if over limit, else 0."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, window, now)
            if len(q) >= limit:
                return max(1, int(q[0] + window - now) + 1)
        return 0

    def hit(self, key: str, window: float) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, window, now).append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
LOGIN_LIMIT = 10  # failed attempts per window, per (ip) and per (ip, username)
LOGIN_WINDOW = 300.0
REGISTER_LIMIT = 10  # attempts per window per ip
REGISTER_WINDOW = 3600.0


def reset_rate_limits() -> None:
    limiter.reset()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_limit(key: str, limit: int, window: float) -> None:
    wait = limiter.blocked(key, limit, window)
    if wait:
        raise ApiError(429, "Too many attempts, try again later", headers={"Retry-After": str(wait)})
