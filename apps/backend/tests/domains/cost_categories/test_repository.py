"""CostCategoryRepository tests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.models import Client
from app.domains.cost_categories.models import CostCategory
from app.domains.cost_categories.repository import CostCategoryRepository
from app.domains.events.models import Event, EventStatus
from app.shared.errors import NotFoundError


async def _seed_event(session: AsyncSession) -> Event:
    client = Client(company_name="Acme")
    session.add(client)
    await session.flush()
    event = Event(client_id=client.id, name="Gala", status=EventStatus.DRAFT)
    session.add(event)
    await session.flush()
    return event


async def test_add_and_get(db_session: AsyncSession) -> None:
    event = await _seed_event(db_session)
    repo = CostCategoryRepository(db_session)
    category = CostCategory(event_id=event.id, name="Venue", display_order=1)
    await repo.add(category)
    await db_session.commit()

    loaded = await repo.get_by_id(category.id)
    assert loaded is not None
    assert loaded.name == "Venue"


async def test_get_required_missing(db_session: AsyncSession) -> None:
    repo = CostCategoryRepository(db_session)
    with pytest.raises(NotFoundError):
        await repo.get_required(uuid.uuid4())


async def test_excludes_archived(db_session: AsyncSession) -> None:
    event = await _seed_event(db_session)
    repo = CostCategoryRepository(db_session)
    category = CostCategory(
        event_id=event.id,
        name="Old",
        display_order=0,
        archived_at=datetime.now(UTC),
    )
    await repo.add(category)
    await db_session.commit()
    assert await repo.get_by_id(category.id) is None


async def test_list_search_filter_pagination(db_session: AsyncSession) -> None:
    event = await _seed_event(db_session)
    other = await _seed_event(db_session)
    repo = CostCategoryRepository(db_session)
    await repo.add(CostCategory(event_id=event.id, name="Venue", display_order=1))
    await repo.add(CostCategory(event_id=event.id, name="Catering", display_order=2))
    await repo.add(CostCategory(event_id=other.id, name="Venue Other", display_order=1))
    await db_session.commit()

    rows, total = await repo.list_paginated(
        q="venue", sort=None, offset=0, limit=10, event_id=event.id
    )
    assert total == 1
    assert rows[0].name == "Venue"

    rows, total = await repo.list_paginated(
        q=None, sort="display_order", offset=0, limit=1, event_id=event.id
    )
    assert total == 2
    assert len(rows) == 1
    assert rows[0].name == "Venue"
