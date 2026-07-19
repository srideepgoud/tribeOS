"""VendorService tests."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.vendors.schemas import VendorCreate, VendorUpdate
from app.domains.vendors.service import VendorService
from app.shared.errors import NotFoundError
from app.shared.pagination import PageParams


async def test_create_normalizes_fields(db_session: AsyncSession) -> None:
    service = VendorService(db_session)
    created = await service.create(
        VendorCreate(
            company_name="  Audio Pro  ",
            email="INFO@AUDIO.COM",
            gst_number=" 22aaaaa0000a1z5 ",
            pan_number=" abcde1234f ",
            ifsc=" hdfc0001234 ",
            phone="   ",
        )
    )
    assert created.company_name == "Audio Pro"
    assert created.email == "info@audio.com"
    assert created.gst_number == "22AAAAA0000A1Z5"
    assert created.pan_number == "ABCDE1234F"
    assert created.ifsc == "HDFC0001234"
    assert created.phone is None


async def test_update_and_archive(db_session: AsyncSession) -> None:
    service = VendorService(db_session)
    created = await service.create(VendorCreate(company_name="Audio Pro"))
    updated = await service.update(created.id, VendorUpdate(notes="Preferred"))
    assert updated.notes == "Preferred"

    await service.archive(created.id)
    with pytest.raises(NotFoundError):
        await service.get(created.id)
    rows, total = await service.list(page=PageParams(page=1, page_size=20), q=None, sort=None)
    assert total == 0
    assert list(rows) == []


async def test_get_missing(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await VendorService(db_session).get(uuid.uuid4())
