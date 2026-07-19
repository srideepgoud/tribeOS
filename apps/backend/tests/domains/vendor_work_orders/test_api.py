"""Vendor Work Orders API tests."""

from __future__ import annotations

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.vendors.schemas import VendorCreate
from app.domains.vendors.service import VendorService


async def _seed_ids(session: AsyncSession) -> tuple[str, str]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Audio")
    )
    item = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="PA System",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("50000.00"),
            negotiated_amount=Decimal("45000.00"),
            vendor_required=True,
        )
    )
    vendor = await VendorService(session).create(VendorCreate(company_name="Audio Pro"))
    return str(item.id), str(vendor.id)


async def test_crud_transition_no_delete(api_client: AsyncClient, db_session: AsyncSession) -> None:
    cost_item_id, vendor_id = await _seed_ids(db_session)

    create = await api_client.post(
        "/api/v1/vendor-work-orders",
        json={"cost_item_id": cost_item_id, "vendor_id": vendor_id, "scope": "Full PA"},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["success"] is True
    assert body["data"]["status"] == "Draft"
    assert body["data"]["version"] == 1
    assert body["data"]["agreed_amount"] == "45000.00"
    wo_id = body["data"]["id"]
    number = body["data"]["work_order_number"]

    listed = await api_client.get(
        "/api/v1/vendor-work-orders",
        params={"q": number[:6], "vendor_id": vendor_id, "page_size": 10},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["pagination"]["total_items"] == 1

    patched = await api_client.patch(
        f"/api/v1/vendor-work-orders/{wo_id}", json={"status": "Approved"}
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["status"] == "Approved"

    deleted = await api_client.delete(f"/api/v1/vendor-work-orders/{wo_id}")
    assert deleted.status_code == 405
