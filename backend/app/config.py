"""Environment-driven configuration. Values are read lazily so tests can set env first."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
DEV_SECRET = "dev-only-insecure-secret-do-not-use-in-prod"


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    app_env: str
    jwt_secret: str
    cors_origins: list
    access_token_minutes: int
    database_path: Path
    upload_dir: Path
    admin_username: str | None
    admin_password: str | None

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"


def _int(name: str, default: int) -> int:
    try:
        v = int(os.environ.get(name, "") or default)
        return v if v > 0 else default
    except ValueError:
        return default


def get_settings() -> Settings:
    env = (os.environ.get("APP_ENV") or "prod").strip().lower()
    secret = os.environ.get("JWT_SECRET") or ""
    if not secret and env == "dev":
        secret = DEV_SECRET
    origins = [o.strip() for o in (os.environ.get("CORS_ORIGINS") or DEFAULT_ORIGINS).split(",") if o.strip()]
    db_path = os.environ.get("DATABASE_PATH") or str(BACKEND_DIR / "repcarparts.db")
    up_dir = os.environ.get("UPLOAD_DIR") or str(BACKEND_DIR / "uploads")
    return Settings(
        app_env=env,
        jwt_secret=secret,
        cors_origins=origins,
        access_token_minutes=_int("ACCESS_TOKEN_MINUTES", 720),
        database_path=Path(db_path).expanduser().resolve(),
        upload_dir=Path(up_dir).expanduser().resolve(),
        admin_username=(os.environ.get("ADMIN_USERNAME") or "").strip() or None,
        admin_password=os.environ.get("ADMIN_PASSWORD") or None,
    )


def validate_settings(s: Settings | None = None) -> Settings:
    s = s or get_settings()
    if not s.is_dev:
        if not s.jwt_secret:
            raise ConfigError("JWT_SECRET is required unless APP_ENV=dev")
        if len(s.jwt_secret) < 32:
            raise ConfigError("JWT_SECRET must be at least 32 characters")
    return s
