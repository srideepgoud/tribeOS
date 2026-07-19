"""ClientService tests (business logic: normalization, soft delete, not-found)."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate, ClientUpdate
from app.domains.clients.service import ClientService
from app.shared.errors import NotFoundError
from app.shared.pagination import PageParams


async def test_create_normalizes_fields(db_session: AsyncSession) -> None:
    service = ClientService(db_session)
    created = await service.create(
        ClientCreate(company_name="  Acme  ", email="INFO@ACME.COM", phone="   ")
    )
    assert created.company_name == "Acme"
    assert created.email == "info@acme.com"
    assert created.phone is None  # blank optional stored as NULL


async def test_get_missing_raises_not_found(db_session: AsyncSession) -> None:
    service = ClientService(db_session)
    with pytest.raises(NotFoundError):
        await service.get(uuid.uuid4())


async def test_update_applies_partial_changes(db_session: AsyncSession) -> None:
    service = ClientService(db_session)
    created = await service.create(ClientCreate(company_name="Acme"))
    updated = await service.update(created.id, ClientUpdate(notes="VIP client"))
    assert updated.notes == "VIP client"
    assert updated.company_name == "Acme"


async def test_archive_soft_deletes(db_session: AsyncSession) -> None:
    service = ClientService(db_session)
    created = await service.create(ClientCreate(company_name="Acme"))

    await service.archive(created.id)

    with pytest.raises(NotFoundError):
        await service.get(created.id)
    rows, total = await service.list(page=PageParams(page=1, page_size=20), q=None, sort=None)
    assert total == 0
    assert list(rows) == []
