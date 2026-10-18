from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import errors
from .bootstrap import ensure_ready
from .config import get_settings
from .routers import auth, cars, manager, me, records, reminders

log = logging.getLogger("repcarparts")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_ready()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="repcarparts API", lifespan=lifespan)
    errors.install(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
    )

    # directory is created at startup; check_dir=False keeps import side-effect free
    app.mount("/uploads", StaticFiles(directory=str(s.upload_dir), check_dir=False), name="uploads")

    @app.get("/")
    def root():
        return {"name": "repcarparts API", "docs": "/docs", "health": "/health"}

    @app.get("/health")
    def health():
        return {"ok": True}

    for r in (auth.router, me.router, cars.router, records.router, reminders.router, manager.router):
        app.include_router(r)
    return app


app = create_app()
