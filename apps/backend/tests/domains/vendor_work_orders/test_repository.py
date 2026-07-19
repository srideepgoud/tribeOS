"""VendorWorkOrderRepository tests."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
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
from app.domains.vendor_work_orders.models import VendorWorkOrder, VendorWorkOrderStatus
from app.domains.vendor_work_orders.repository import VendorWorkOrderRepository
from app.domains.vendors.schemas import VendorCreate
from app.domains.vendors.service import VendorService
from app.shared.errors import NotFoundError


async def _seed(session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
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
    return item.id, vendor.id


async def test_add_get_and_active_counts(db_session: AsyncSession) -> None:
    cost_item_id, vendor_id = await _seed(db_session)
    repo = VendorWorkOrderRepository(db_session)
    wo = VendorWorkOrder(
        cost_item_id=cost_item_id,
        vendor_id=vendor_id,
        work_order_number="WO-TEST00000001",
        agreed_amount=Decimal("45000.00"),
        version=1,
        status=VendorWorkOrderStatus.DRAFT,
    )
    await repo.add(wo)
    await db_session.commit()

    loaded = await repo.get_by_id(wo.id)
    assert loaded is not None
    assert loaded.work_order_number == "WO-TEST00000001"
    assert await repo.count_active_by_cost_item(cost_item_id) == 1
    assert await repo.count_active_by_vendor(vendor_id) == 1

    wo.status = VendorWorkOrderStatus.CANCELLED
    await db_session.commit()
    assert await repo.count_active_by_cost_item(cost_item_id) == 0
    assert await repo.count_active_by_vendor(vendor_id) == 0


async def test_get_required_missing(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await VendorWorkOrderRepository(db_session).get_required(uuid.uuid4())
