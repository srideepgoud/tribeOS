"""ClientRepository tests (persistence behavior)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.models import Client
from app.domains.clients.repository import ClientRepository


async def test_add_and_get_by_id(db_session: AsyncSession) -> None:
    repo = ClientRepository(db_session)
    client = Client(company_name="Acme")
    await repo.add(client)
    await db_session.commit()

    fetched = await repo.get_by_id(client.id)
    assert fetched is not None
    assert fetched.company_name == "Acme"


async def test_get_by_id_missing_returns_none(db_session: AsyncSession) -> None:
    repo = ClientRepository(db_session)
    assert await repo.get_by_id(uuid.uuid4()) is None


async def test_list_excludes_archived(db_session: AsyncSession) -> None:
    repo = ClientRepository(db_session)
    active = Client(company_name="Active Co")
    archived = Client(company_name="Archived Co", archived_at=datetime.now(UTC))
    await repo.add(active)
    await repo.add(archived)
    await db_session.commit()

    rows, total = await repo.list_paginated(q=None, sort=None, offset=0, limit=20)
    names = {row.company_name for row in rows}
    assert names == {"Active Co"}
    assert total == 1


async def test_search_matches_company_name_case_insensitive(db_session: AsyncSession) -> None:
    repo = ClientRepository(db_session)
    await repo.add(Client(company_name="Stage Masters"))
    await repo.add(Client(company_name="Lighting Ltd"))
    await db_session.commit()

    rows, total = await repo.list_paginated(q="STAGE", sort=None, offset=0, limit=20)
    assert total == 1
    assert rows[0].company_name == "Stage Masters"


async def test_list_pagination_offset_limit(db_session: AsyncSession) -> None:
    repo = ClientRepository(db_session)
    for i in range(5):
        await repo.add(Client(company_name=f"Co {i}"))
    await db_session.commit()

    rows, total = await repo.list_paginated(q=None, sort="company_name", offset=0, limit=2)
    assert total == 5
    assert len(rows) == 2
