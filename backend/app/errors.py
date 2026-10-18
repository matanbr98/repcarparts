"""Structured error responses (contract section 0) with v1-compatible top-level `detail`."""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("repcarparts")

_CODES = {
    400: "validation_error",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "file_too_large",
    415: "unsupported_media",
    422: "validation_error",
    429: "rate_limited",
}


class ApiError(HTTPException):
    """HTTPException carrying an optional per-field message map."""

    def __init__(
        self,
        status_code: int,
        message: str,
        fields: dict | None = None,
        headers: dict | None = None,
        code: str | None = None,
    ):
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.fields = fields or None
        self.code = code


def bad_field(field: str, message: str, status_code: int = 422) -> ApiError:
    return ApiError(status_code, message, {field: message})


def _body(status: int, message: str, fields=None, code: str | None = None) -> dict:
    err = {"code": code or _CODES.get(status, "error"), "message": message}
    if fields:
        err["fields"] = fields
    return {"error": err, "detail": message}


def install(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        msg = exc.detail if isinstance(exc.detail, str) else "Request failed"
        fields = getattr(exc, "fields", None)
        return JSONResponse(
            _body(exc.status_code, msg, fields, code=getattr(exc, "code", None)),
            status_code=exc.status_code,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        fields: dict = {}
        for e in exc.errors():
            loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "form", "path")]
            key = ".".join(loc) or "body"
            msg = str(e.get("msg", "Invalid value"))
            if msg.startswith("Value error, "):
                msg = msg[len("Value error, "):]
            fields.setdefault(key, msg)
        if fields:
            message = "Validation failed: " + "; ".join(f"{k}: {v}" for k, v in fields.items())
        else:
            message = "Validation failed"
        return JSONResponse(_body(422, message, fields), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(_body(500, "Internal server error", code="server_error"), status_code=500)
