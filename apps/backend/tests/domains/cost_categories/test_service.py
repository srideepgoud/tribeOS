"""CostCategoryService tests."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_categories.schemas import CostCategoryCreate, CostCategoryUpdate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.shared.errors import ConflictError, NotFoundError
from app.shared.pagination import PageParams


async def _event_id(session: AsyncSession) -> uuid.UUID:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    return event.id


async def test_create_and_unique_within_event(db_session: AsyncSession) -> None:
    event_id = await _event_id(db_session)
    service = CostCategoryService(db_session)
    created = await service.create(
        CostCategoryCreate(event_id=event_id, name="  Venue  ", display_order=1)
    )
    assert created.name == "Venue"

    with pytest.raises(ConflictError, match="unique within an event"):
        await service.create(CostCategoryCreate(event_id=event_id, name="Venue"))


async def test_create_missing_event(db_session: AsyncSession) -> None:
    service = CostCategoryService(db_session)
    with pytest.raises(NotFoundError, match="Event"):
        await service.create(CostCategoryCreate(event_id=uuid.uuid4(), name="Venue"))


async def test_update_and_archive(db_session: AsyncSession) -> None:
    event_id = await _event_id(db_session)
    service = CostCategoryService(db_session)
    created = await service.create(CostCategoryCreate(event_id=event_id, name="Venue"))
    updated = await service.update(created.id, CostCategoryUpdate(display_order=5))
    assert updated.display_order == 5

    await service.archive(created.id)
    with pytest.raises(NotFoundError):
        await service.get(created.id)
    rows, total = await service.list(
        page=PageParams(page=1, page_size=20), q=None, sort=None, event_id=event_id
    )
    assert total == 0
    assert list(rows) == []


async def test_archive_allows_name_reuse(db_session: AsyncSession) -> None:
    event_id = await _event_id(db_session)
    service = CostCategoryService(db_session)
    first = await service.create(CostCategoryCreate(event_id=event_id, name="Venue"))
    await service.archive(first.id)
    reused = await service.create(CostCategoryCreate(event_id=event_id, name="Venue"))
    assert reused.name == "Venue"
    assert reused.id != first.id
