"""Test fixtures.

Dummy environment variables are set before the application is imported so the
foundation (settings, app creation, non-DB endpoints) can be exercised offline
without a real Supabase project.

Repository / service / API tests run against an in-memory SQLite database
(``aiosqlite``) with the real ORM metadata, so they are fast and never touch
Supabase. The queries used by the Clients repository are portable across SQLite
and PostgreSQL.
"""

from __future__ import annotations

import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/tribeos_test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_session
from app.domains.clients import models as _clients_models  # noqa: F401  (register table)
from app.domains.cost_categories import models as _cost_categories_models  # noqa: F401
from app.domains.cost_items import models as _cost_items_models  # noqa: F401
from app.domains.events import models as _events_models  # noqa: F401  (register table)
from app.domains.vendors import models as _vendors_models  # noqa: F401
from app.main import create_app


@pytest.fixture()
def client() -> TestClient:
    """TestClient for offline (non-DB) smoke tests."""
    return TestClient(create_app())


@pytest_asyncio.fixture()
async def db_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Fresh in-memory SQLite engine with all tables created."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture()
async def api_client(db_engine: AsyncEngine) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client bound to the app, with the DB session overridden to SQLite."""
    factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()
