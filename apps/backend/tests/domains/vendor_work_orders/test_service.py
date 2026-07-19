"""VendorWorkOrderService tests — invariants, lock, transitions, vendor archive."""

from __future__ import annotations

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
from app.domains.vendor_work_orders.models import VendorWorkOrderStatus
from app.domains.vendor_work_orders.schemas import VendorWorkOrderCreate, VendorWorkOrderUpdate
from app.domains.vendor_work_orders.service import VendorWorkOrderService
from app.domains.vendors.schemas import VendorCreate
from app.domains.vendors.service import VendorService
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError


async def _seed(session: AsyncSession) -> tuple[object, object, object]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Audio")
    )
    vendor_item = await CostItemService(session).create(
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
    internal_item = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Staff meals",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("5000.00"),
        )
    )
    vendor = await VendorService(session).create(VendorCreate(company_name="Audio Pro"))
    return vendor_item, internal_item, vendor


async def test_create_defaults_and_transitions(db_session: AsyncSession) -> None:
    vendor_item, _, vendor = await _seed(db_session)
    service = VendorWorkOrderService(db_session)
    wo = await service.create(
        VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id, scope="Full PA")
    )
    assert wo.status == VendorWorkOrderStatus.DRAFT
    assert wo.version == 1
    assert wo.agreed_amount == Decimal("45000.00")
    assert wo.work_order_number.startswith("WO-")

    wo = await service.transition_status(wo.id, VendorWorkOrderStatus.APPROVED)
    assert wo.status == VendorWorkOrderStatus.APPROVED
    wo = await service.update(wo.id, VendorWorkOrderUpdate(scope="Updated scope"))
    assert wo.scope == "Updated scope"

    wo = await service.transition_status(wo.id, VendorWorkOrderStatus.ISSUED)
    with pytest.raises(InvalidStateError):
        await service.update(wo.id, VendorWorkOrderUpdate(scope="Should fail"))

    wo = await service.transition_status(wo.id, VendorWorkOrderStatus.IN_PROGRESS)
    wo = await service.transition_status(wo.id, VendorWorkOrderStatus.COMPLETED)
    assert wo.status == VendorWorkOrderStatus.COMPLETED


async def test_one_active_and_replace_after_cancel(db_session: AsyncSession) -> None:
    vendor_item, _, vendor = await _seed(db_session)
    service = VendorWorkOrderService(db_session)
    first = await service.create(
        VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id)
    )
    with pytest.raises(ConflictError):
        await service.create(
            VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id)
        )

    await service.transition_status(first.id, VendorWorkOrderStatus.CANCELLED)
    second = await service.create(
        VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id)
    )
    assert second.id != first.id
    assert second.work_order_number != first.work_order_number
    assert second.version == 1


async def test_rejects_non_vendor_expense(db_session: AsyncSession) -> None:
    _, internal_item, vendor = await _seed(db_session)
    with pytest.raises(DomainValidationError):
        await VendorWorkOrderService(db_session).create(
            VendorWorkOrderCreate(cost_item_id=internal_item.id, vendor_id=vendor.id)
        )


async def test_vendor_archive_blocked_while_active(db_session: AsyncSession) -> None:
    vendor_item, _, vendor = await _seed(db_session)
    await VendorWorkOrderService(db_session).create(
        VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id)
    )
    with pytest.raises(ConflictError):
        await VendorService(db_session).archive(vendor.id)
