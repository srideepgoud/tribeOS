"""EventService tests — state machine, archive, client association."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate, EventUpdate
from app.domains.events.service import EventService
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams


async def _client(session: AsyncSession) -> uuid.UUID:
    return (await ClientService(session).create(ClientCreate(company_name="Acme"))).id


async def test_create_starts_as_draft(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    event = await service.create(
        EventCreate(client_id=client_id, name="  Gala  ", expected_revenue=Decimal("1000.50"))
    )
    assert event.status == EventStatus.DRAFT
    assert event.name == "Gala"
    assert event.expected_revenue == Decimal("1000.50")


async def test_create_missing_client(db_session: AsyncSession) -> None:
    service = EventService(db_session)
    with pytest.raises(NotFoundError):
        await service.create(EventCreate(client_id=uuid.uuid4(), name="Orphan"))


async def test_valid_and_invalid_transitions(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    event = await service.create(EventCreate(client_id=client_id, name="Path"))

    event = await service.transition_status(event.id, EventStatus.PLANNING)
    assert event.status == EventStatus.PLANNING

    with pytest.raises(InvalidStateError, match="Cannot transition"):
        await service.transition_status(event.id, EventStatus.EXECUTION)

    event = await service.transition_status(event.id, EventStatus.COMMERCIALS)
    event = await service.transition_status(event.id, EventStatus.PROCUREMENT)
    event = await service.transition_status(event.id, EventStatus.EXECUTION)
    event = await service.transition_status(event.id, EventStatus.SETTLEMENT)
    event = await service.transition_status(event.id, EventStatus.CLOSED)
    assert event.status == EventStatus.CLOSED

    with pytest.raises(InvalidStateError, match="cannot be reopened"):
        await service.transition_status(event.id, EventStatus.PLANNING)


async def test_update_cannot_change_status(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    event = await service.create(EventCreate(client_id=client_id, name="Stay Draft"))
    updated = await service.update(
        event.id, EventUpdate(status=EventStatus.PLANNING, notes="hello")
    )
    assert updated.status == EventStatus.DRAFT
    assert updated.notes == "hello"


async def test_closed_is_read_only(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    event = await service.create(EventCreate(client_id=client_id, name="Close me"))
    for nxt in (
        EventStatus.PLANNING,
        EventStatus.COMMERCIALS,
        EventStatus.PROCUREMENT,
        EventStatus.EXECUTION,
        EventStatus.SETTLEMENT,
        EventStatus.CLOSED,
    ):
        event = await service.transition_status(event.id, nxt)

    with pytest.raises(InvalidStateError, match="Closed events cannot be modified"):
        await service.update(event.id, EventUpdate(notes="nope"))


async def test_cancel_then_immutable(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    event = await service.create(EventCreate(client_id=client_id, name="Cancel me"))
    event = await service.transition_status(event.id, EventStatus.CANCELLED)

    with pytest.raises(InvalidStateError, match="Cancelled"):
        await service.update(event.id, EventUpdate(notes="nope"))
    with pytest.raises(InvalidStateError, match="Cancelled"):
        await service.transition_status(event.id, EventStatus.PLANNING)


async def test_archive_draft_only(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    draft = await service.create(EventCreate(client_id=client_id, name="Draft archive"))
    await service.archive(draft.id)
    with pytest.raises(NotFoundError):
        await service.get(draft.id)

    planning = await service.create(EventCreate(client_id=client_id, name="Planning"))
    await service.transition_status(planning.id, EventStatus.PLANNING)
    with pytest.raises(InvalidStateError, match="Only Draft"):
        await service.archive(planning.id)


async def test_datetime_order_validation(db_session: AsyncSession) -> None:
    client_id = await _client(db_session)
    service = EventService(db_session)
    start = datetime.now(UTC)
    end = start - timedelta(days=1)
    with pytest.raises(DomainValidationError, match="end_datetime"):
        await service.create(
            EventCreate(
                client_id=client_id, name="Bad dates", start_datetime=start, end_datetime=end
            )
        )


async def test_client_archive_blocked_by_non_archived_event(db_session: AsyncSession) -> None:
    clients = ClientService(db_session)
    events = EventService(db_session)
    client = await clients.create(ClientCreate(company_name="Blocked"))
    await events.create(EventCreate(client_id=client.id, name="Open event"))

    with pytest.raises(ConflictError, match="non-archived events"):
        await clients.archive(client.id)

    event = (await events.list(page=PageParams(page=1, page_size=20), q=None, sort=None))[0][0]
    await events.archive(event.id)
    await clients.archive(client.id)
    with pytest.raises(NotFoundError):
        await clients.get(client.id)
