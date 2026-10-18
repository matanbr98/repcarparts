from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings

_settings = get_settings()
DB_PATH = _settings.database_path
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    # Local import avoids a cycle; ensure_ready is idempotent and cheap after first call.
    from .bootstrap import ensure_ready

    ensure_ready()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
