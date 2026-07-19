"""CostItemRepository tests."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.models import Client
from app.domains.cost_categories.models import CostCategory
from app.domains.cost_items.models import CostItem, CostItemStatus, ExpenseType
from app.domains.cost_items.repository import CostItemRepository
from app.domains.events.models import Event, EventStatus
from app.shared.errors import NotFoundError


async def _seed(session: AsyncSession) -> tuple[Event, CostCategory]:
    client = Client(company_name="Acme")
    session.add(client)
    await session.flush()
    event = Event(client_id=client.id, name="Gala", status=EventStatus.DRAFT)
    session.add(event)
    await session.flush()
    category = CostCategory(event_id=event.id, name="Venue", display_order=1)
    session.add(category)
    await session.flush()
    return event, category


async def test_add_get_and_versions(db_session: AsyncSession) -> None:
    event, category = await _seed(db_session)
    repo = CostItemRepository(db_session)
    item = CostItem(
        event_id=event.id,
        category_id=category.id,
        title="Ballroom",
        expense_type=ExpenseType.VENDOR,
        budget_amount=Decimal("100000.00"),
        vendor_required=True,
        status=CostItemStatus.PLANNED,
    )
    await repo.add(item)
    await db_session.commit()

    loaded = await repo.get_by_id(item.id)
    assert loaded is not None
    assert loaded.title == "Ballroom"
    assert await repo.next_version_number(item.id) == 1


async def test_get_required_missing(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await CostItemRepository(db_session).get_required(uuid.uuid4())


async def test_count_by_category(db_session: AsyncSession) -> None:
    event, category = await _seed(db_session)
    repo = CostItemRepository(db_session)
    await repo.add(
        CostItem(
            event_id=event.id,
            category_id=category.id,
            title="A",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("10"),
            vendor_required=False,
            status=CostItemStatus.PLANNED,
        )
    )
    await db_session.commit()
    assert await repo.count_non_archived_by_category(category.id) == 1
