"""Upload validation/storage. Files are content-sniffed, size-capped and given uuid names."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .errors import ApiError

log = logging.getLogger("repcarparts")
MAX_BYTES = 5 * 1024 * 1024
URL_PREFIX = "uploads/"


def upload_dir() -> Path:
    return get_settings().upload_dir


def _sniff(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


async def save_image(file: UploadFile) -> str:
    """Validate and store; returns `uploads/<uuid>.<ext>`."""
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ApiError(413, "File too large (max 5 MB)")
    if not data:
        raise ApiError(415, "Empty file")
    ext = _sniff(data[:16])
    if ext is None:
        raise ApiError(415, "Unsupported image type (use JPEG, PNG or WebP)")
    d = upload_dir()
    d.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (d / name).write_bytes(data)
    return URL_PREFIX + name


def _still_referenced(db: Session, url: str) -> bool:
    for model, col in (
        (models.ServiceRecord, models.ServiceRecord.image_url),
        (models.Reminder, models.Reminder.image_url),
        (models.User, models.User.profile_image_url),
    ):
        if db.query(model.id).filter(col == url).first():
            return True
    return False


def delete_image(db: Session | None, url: str | None) -> None:
    """Best-effort delete confined to UPLOAD_DIR. Callers should clear the DB reference first
    (and flush) so a still-referenced file (shared legacy name) is kept."""
    if not url or not url.startswith(URL_PREFIX):
        return
    name = url[len(URL_PREFIX):]
    if not name or "/" in name or "\\" in name or name in (".", ".."):
        return
    try:
        if db is not None and _still_referenced(db, url):
            return
        base = upload_dir().resolve()
        path = (base / name).resolve()
        if path.parent != base or not path.is_file():
            return
        path.unlink()
    except Exception:
        log.warning("Could not delete upload %s", name)
