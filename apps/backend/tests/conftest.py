"""Test fixtures.

Dummy environment variables are set before the application is imported so the
foundation (settings, app creation, non-DB endpoints) can be exercised offline
without a real Supabase project. The database URL is syntactically valid but is
never connected to by these smoke tests.
"""

from __future__ import annotations

import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/tribeos_test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client() -> TestClient:
    """Return a TestClient wrapping a freshly created application."""
    return TestClient(create_app())
