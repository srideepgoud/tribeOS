"""CostItemService tests — state machine, budget lock, versioning."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import CostItemStatus, ExpenseType
from app.domains.cost_items.schemas import CostItemCreate, CostItemUpdate
from app.domains.cost_items.service import CostItemService
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError


async def _seed(session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Venue")
    )
    return event.id, category.id


async def test_create_planned_and_version_on_budget_change(db_session: AsyncSession) -> None:
    event_id, category_id = await _seed(db_session)
    service = CostItemService(db_session)
    item = await service.create(
        CostItemCreate(
            event_id=event_id,
            category_id=category_id,
            title="Ballroom",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("100000.00"),
            vendor_required=True,
        )
    )
    assert item.status == CostItemStatus.PLANNED
    assert item.actual_amount is None

    updated = await service.update(item.id, CostItemUpdate(budget_amount=Decimal("120000.00")))
    assert updated.budget_amount == Decimal("120000.00")
    versions = await service.list_versions(item.id)
    assert len(versions) == 1
    assert versions[0].budget_amount == Decimal("100000.00")
    assert versions[0].version_number == 1


async def test_notes_change_does_not_version(db_session: AsyncSession) -> None:
    event_id, category_id = await _seed(db_session)
    service = CostItemService(db_session)
    item = await service.create(
        CostItemCreate(
            event_id=event_id,
            category_id=category_id,
            title="Ballroom",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("5000"),
            vendor_required=False,
        )
    )
    await service.update(item.id, CostItemUpdate(notes="hello"))
    assert await service.list_versions(item.id) == []


async def test_budget_immutable_after_approved(db_session: AsyncSession) -> None:
    event_id, category_id = await _seed(db_session)
    service = CostItemService(db_session)
    item = await service.create(
        CostItemCreate(
            event_id=event_id,
            category_id=category_id,
            title="Ballroom",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("100000"),
            vendor_required=True,
        )
    )
    await service.transition_status(item.id, CostItemStatus.APPROVED)
    with pytest.raises(InvalidStateError, match="immutable"):
        await service.update(item.id, CostItemUpdate(budget_amount=Decimal("1")))


async def test_category_must_match_event(db_session: AsyncSession) -> None:
    event_id, _ = await _seed(db_session)
    other_event = await EventService(db_session).create(
        EventCreate(
            client_id=(await ClientService(db_session).create(ClientCreate(company_name="B"))).id,
            name="Other",
        )
    )
    other_cat = await CostCategoryService(db_session).create(
        CostCategoryCreate(event_id=other_event.id, name="Other Cat")
    )
    service = CostItemService(db_session)
    with pytest.raises(DomainValidationError, match="same Event"):
        await service.create(
            CostItemCreate(
                event_id=event_id,
                category_id=other_cat.id,
                title="Mismatch",
                expense_type=ExpenseType.INTERNAL,
                budget_amount=Decimal("10"),
                vendor_required=False,
            )
        )


async def test_internal_cannot_require_vendor(db_session: AsyncSession) -> None:
    event_id, category_id = await _seed(db_session)
    with pytest.raises(DomainValidationError, match="Internal"):
        await CostItemService(db_session).create(
            CostItemCreate(
                event_id=event_id,
                category_id=category_id,
                title="Fuel",
                expense_type=ExpenseType.INTERNAL,
                budget_amount=Decimal("10"),
                vendor_required=True,
            )
        )


async def test_category_archive_blocked(db_session: AsyncSession) -> None:
    event_id, category_id = await _seed(db_session)
    await CostItemService(db_session).create(
        CostItemCreate(
            event_id=event_id,
            category_id=category_id,
            title="Ballroom",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("100"),
            vendor_required=True,
        )
    )
    with pytest.raises(ConflictError, match="Cost Items"):
        await CostCategoryService(db_session).archive(category_id)


async def test_transitions_and_completed_readonly(db_session: AsyncSession) -> None:
    event_id, category_id = await _seed(db_session)
    service = CostItemService(db_session)
    item = await service.create(
        CostItemCreate(
            event_id=event_id,
            category_id=category_id,
            title="Ballroom",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("100"),
            vendor_required=True,
        )
    )
    await service.transition_status(item.id, CostItemStatus.APPROVED)
    await service.transition_status(item.id, CostItemStatus.IN_PROGRESS)
    await service.transition_status(item.id, CostItemStatus.COMPLETED)
    with pytest.raises(InvalidStateError, match="Completed"):
        await service.update(item.id, CostItemUpdate(notes="nope"))
    with pytest.raises(InvalidStateError):
        await service.transition_status(item.id, CostItemStatus.PLANNED)
