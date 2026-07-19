"""Centralized exception handlers producing the standard error envelope.

Every error response follows ``docs/api_contract.md``:

    {"success": false, "error": {"code": "...", "message": "...", "details": [...]}}

Stack traces are never exposed to clients.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger
from app.shared.errors import AppError

logger = get_logger(__name__)

# Maps HTTP status codes to stable, machine-readable error codes.
_STATUS_CODE_MAP: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    422: "VALIDATION_ERROR",
}


def _error_body(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"success": False, "error": error}


def register_error_handlers(app: FastAPI) -> None:
    """Attach centralized exception handlers to the application."""

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"field": ".".join(str(p) for p in err.get("loc", [])), "message": err.get("msg", "")}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_error_body(
                "VALIDATION_ERROR",
                "One or more fields are invalid.",
                jsonable_encoder(details),
            ),
        )

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = _STATUS_CODE_MAP.get(exc.status_code, "ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=exc.status_code, content=_error_body(code, message))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        # Log the real error server-side; never leak internals to the client.
        logger.error("unhandled_exception", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("INTERNAL_ERROR", "An unexpected error occurred."),
        )
