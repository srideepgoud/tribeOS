"""Infrastructure health endpoints.

These are operational (not business) endpoints and are intentionally served
outside the versioned ``/api/v1`` namespace so load balancers, uptime checks,
and deployment platforms can consume them at stable paths (see
``docs/api_contract.md`` — infrastructure endpoints exception).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}


@router.get("/health/database")
async def health_database(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    """Readiness check: verifies database connectivity."""
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
