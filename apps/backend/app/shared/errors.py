"""Domain-level errors, decoupled from HTTP.

Services raise these; the API layer (``app/api/errors/handlers.py``) maps them to
the standard error envelope defined in ``docs/api_contract.md``. This keeps the
service layer free of HTTP/framework concerns.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base application error mapped to the standard error envelope."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, *, details: Any | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    """Requested resource does not exist (HTTP 404)."""

    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    """Uniqueness or state conflict (HTTP 409)."""

    status_code = 409
    code = "CONFLICT"


class DomainValidationError(AppError):
    """Business validation failed (HTTP 422)."""

    status_code = 422
    code = "VALIDATION_ERROR"
