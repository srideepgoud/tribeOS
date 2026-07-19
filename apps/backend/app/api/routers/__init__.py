"""Top-level API router aggregation.

Every business domain router is registered here, so ``main.py`` includes a
single ``api_router`` and never needs to know about individual domains. Each
domain router already carries its own ``/api/v1/<resource>`` prefix.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.domains.clients.router import router as clients_router
from app.domains.cost_categories.router import router as cost_categories_router
from app.domains.events.router import router as events_router

api_router = APIRouter()
api_router.include_router(clients_router)
api_router.include_router(events_router)
api_router.include_router(cost_categories_router)
