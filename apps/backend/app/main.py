"""FastAPI application factory.

Wires logging, a request-ID middleware, centralized error handlers, and the
infrastructure health router. No business routes are registered in Milestone 0.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.api.errors.handlers import register_error_handlers
from app.api.routers import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging

REQUEST_ID_HEADER = "X-Request-ID"


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title="TribeOS API", version="0.0.0")

    # CORS must be registered for browser clients on a different origin/port.
    # Origins come from ``CORS_ORIGINS`` (comma-separated) or local Next.js defaults.
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    register_error_handlers(app)

    @app.middleware("http")
    async def request_id_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER, str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

    # Infrastructure endpoints (unversioned) + aggregated business API.
    app.include_router(health.router)
    app.include_router(api_router)

    return app


app = create_app()
