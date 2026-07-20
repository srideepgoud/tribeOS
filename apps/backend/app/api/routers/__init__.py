"""Top-level API router aggregation.

Every business domain router is registered here, so ``main.py`` includes a
single ``api_router`` and never needs to know about individual domains. Each
domain router already carries its own ``/api/v1/<resource>`` prefix.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.domains.client_invoices.router import router as client_invoices_router
from app.domains.clients.router import router as clients_router
from app.domains.cost_categories.router import router as cost_categories_router
from app.domains.cost_items.router import router as cost_items_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.events.router import router as events_router
from app.domains.transactions.router import router as transactions_router
from app.domains.vendor_work_orders.router import router as vendor_work_orders_router
from app.domains.vendors.router import router as vendors_router

api_router = APIRouter()
api_router.include_router(dashboard_router)
api_router.include_router(clients_router)
api_router.include_router(events_router)
api_router.include_router(cost_categories_router)
api_router.include_router(cost_items_router)
api_router.include_router(vendors_router)
api_router.include_router(vendor_work_orders_router)
api_router.include_router(client_invoices_router)
api_router.include_router(transactions_router)
