"""EventRepository tests."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.models import Client
from app.domains.events.models import Event, EventStatus
from app.domains.events.repository import EventRepository
from app.shared.errors import NotFoundError


async def _seed_client(session: AsyncSession, name: str = "Acme") -> Client:
    client = Client(company_name=name)
    session.add(client)
    await session.flush()
    return client


async def test_add_and_get(db_session: AsyncSession) -> None:
    client = await _seed_client(db_session)
    repo = EventRepository(db_session)
    event = Event(client_id=client.id, name="Wedding", status=EventStatus.DRAFT)
    await repo.add(event)
    await db_session.commit()

    loaded = await repo.get_by_id(event.id)
    assert loaded is not None
    assert loaded.name == "Wedding"
    assert loaded.status == EventStatus.DRAFT


async def test_get_required_missing(db_session: AsyncSession) -> None:
    repo = EventRepository(db_session)
    with pytest.raises(NotFoundError):
        await repo.get_required(uuid.uuid4())


async def test_exists(db_session: AsyncSession) -> None:
    client = await _seed_client(db_session)
    repo = EventRepository(db_session)
    event = Event(client_id=client.id, name="Gala", status=EventStatus.DRAFT)
    await repo.add(event)
    await db_session.commit()

    assert await repo.exists(event.id) is True
    assert await repo.exists(uuid.uuid4()) is False


async def test_excludes_archived(db_session: AsyncSession) -> None:
    from datetime import UTC, datetime

    client = await _seed_client(db_session)
    repo = EventRepository(db_session)
    event = Event(
        client_id=client.id,
        name="Old",
        status=EventStatus.DRAFT,
        archived_at=datetime.now(UTC),
    )
    await repo.add(event)
    await db_session.commit()

    assert await repo.get_by_id(event.id) is None
    assert await repo.exists(event.id) is False


async def test_list_filters_and_pagination(db_session: AsyncSession) -> None:
    client_a = await _seed_client(db_session, "A Co")
    client_b = await _seed_client(db_session, "B Co")
    repo = EventRepository(db_session)

    for name, status, client in [
        ("Wedding Alpha", EventStatus.DRAFT, client_a),
        ("Corporate Beta", EventStatus.PLANNING, client_a),
        ("Wedding Gamma", EventStatus.DRAFT, client_b),
    ]:
        await repo.add(Event(client_id=client.id, name=name, status=status, venue="Hyderabad"))
    await db_session.commit()

    rows, total = await repo.list_paginated(
        q="wedding", sort=None, offset=0, limit=10, status=None, client_id=None
    )
    assert total == 2
    assert all("Wedding" in r.name for r in rows)

    rows, total = await repo.list_paginated(
        q=None, sort=None, offset=0, limit=10, status=EventStatus.PLANNING, client_id=None
    )
    assert total == 1
    assert rows[0].name == "Corporate Beta"

    rows, total = await repo.list_paginated(
        q=None, sort=None, offset=0, limit=10, status=None, client_id=client_b.id
    )
    assert total == 1
    assert rows[0].client_id == client_b.id

    rows, total = await repo.list_paginated(
        q=None, sort=None, offset=0, limit=2, status=None, client_id=None
    )
    assert total == 3
    assert len(rows) == 2


async def test_count_non_archived_by_client(db_session: AsyncSession) -> None:
    from datetime import UTC, datetime

    client = await _seed_client(db_session)
    repo = EventRepository(db_session)
    await repo.add(Event(client_id=client.id, name="Open", status=EventStatus.DRAFT))
    await repo.add(
        Event(
            client_id=client.id,
            name="Archived",
            status=EventStatus.DRAFT,
            archived_at=datetime.now(UTC),
        )
    )
    await db_session.commit()

    assert await repo.count_non_archived_by_client(client.id) == 1
