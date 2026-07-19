"""VendorRepository tests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.vendors.models import Vendor
from app.domains.vendors.repository import VendorRepository
from app.shared.errors import NotFoundError


async def test_add_and_get(db_session: AsyncSession) -> None:
    repo = VendorRepository(db_session)
    vendor = Vendor(company_name="Audio Pro", email="a@audiopro.com")
    await repo.add(vendor)
    await db_session.commit()

    loaded = await repo.get_by_id(vendor.id)
    assert loaded is not None
    assert loaded.company_name == "Audio Pro"


async def test_get_required_missing(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await VendorRepository(db_session).get_required(uuid.uuid4())


async def test_excludes_archived_and_search(db_session: AsyncSession) -> None:
    repo = VendorRepository(db_session)
    await repo.add(Vendor(company_name="Lighting Co", phone="999"))
    await repo.add(Vendor(company_name="Old Vendor", archived_at=datetime.now(UTC)))
    await db_session.commit()

    rows, total = await repo.list_paginated(q="light", sort=None, offset=0, limit=10)
    assert total == 1
    assert rows[0].company_name == "Lighting Co"

    rows, total = await repo.list_paginated(q=None, sort="company_name", offset=0, limit=10)
    assert total == 1
