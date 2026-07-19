"""Milestone 0 smoke tests.

Verify the foundation works before any business logic exists:
- configuration loads,
- the FastAPI application is created,
- the liveness health endpoint responds.

The database readiness endpoint (`/health/database`) is not covered here; it is
verified separately once real Supabase credentials are available.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_settings_load() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    assert settings.database_url
    assert settings.supabase_url


def test_app_is_created() -> None:
    from app.main import create_app

    app = create_app()
    assert app.title == "TribeOS API"


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_request_id_header_present(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers.get("X-Request-ID")
