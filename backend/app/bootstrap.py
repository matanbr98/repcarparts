"""Startup work (run lazily, once per process/DB): config check, migrations, account hardening."""
from __future__ import annotations

import logging
import threading
from datetime import date

from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy.orm import Session

from . import models
from .config import BACKEND_DIR, get_settings, validate_settings
from .database import DATABASE_URL, SessionLocal, engine
from .security import hash_password, is_locked_hash, unusable_hash, verify_password

log = logging.getLogger("repcarparts")

WEAK_PASSWORDS_FOR_AA = ("aa",)
_lock = threading.Lock()
_ready_key: str | None = None


def run_migrations() -> None:
    cfg = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
    command.upgrade(cfg, "head")


def lock_default_credentials(db: Session) -> int:
    """Lock any account whose password is the literal 'aa'. Never deletes rows."""
    locked = 0
    for u in db.query(models.User).all():
        if is_locked_hash(u.password_hash):
            continue
        if any(verify_password(p, u.password_hash) for p in WEAK_PASSWORDS_FOR_AA):
            u.password_hash = unusable_hash()
            u.must_change_password = True
            u.pwd_version = int(u.pwd_version or 0) + 1
            locked += 1
            log.warning("Locked account %r: default password detected. Run: python -m app.cli set-password %s", u.username, u.username)
    if locked:
        db.commit()
    return locked


def bootstrap_admin(db: Session) -> None:
    """ADMIN_USERNAME/ADMIN_PASSWORD: create the manager, or reset it only while it is locked."""
    s = get_settings()
    if not (s.admin_username and s.admin_password):
        return
    if len(s.admin_password) < 8:
        log.warning("ADMIN_PASSWORD ignored: must be at least 8 characters")
        return
    u = db.query(models.User).filter(models.User.username == s.admin_username).first()
    if u is None:
        db.add(
            models.User(
                username=s.admin_username,
                password_hash=hash_password(s.admin_password),
                role="manager",
                must_change_password=True,
                pwd_version=0,
                created_at=date.today(),
            )
        )
        db.commit()
        log.info("Created manager account %r from environment", s.admin_username)
    elif is_locked_hash(u.password_hash):
        u.password_hash = hash_password(s.admin_password)
        u.role = "manager"
        u.must_change_password = True
        u.pwd_version = int(u.pwd_version or 0) + 1
        db.commit()
        log.info("Reset locked account %r from environment", s.admin_username)


def ensure_ready(check_secret: bool = True) -> None:
    """Idempotent. Called from lifespan and (cheaply) from get_db so that clients that never run the
    lifespan (e.g. a bare TestClient) still get a migrated database."""
    global _ready_key
    key = DATABASE_URL
    if _ready_key == key:
        return
    with _lock:
        if _ready_key == key:
            return
        s = validate_settings() if check_secret else get_settings()
        s.upload_dir.mkdir(parents=True, exist_ok=True)
        s.database_path.parent.mkdir(parents=True, exist_ok=True)
        run_migrations()
        with SessionLocal() as db:
            lock_default_credentials(db)
            bootstrap_admin(db)
        _ready_key = key


def dispose() -> None:
    engine.dispose()
