"""Vendor business logic (docs/business_rules.md — Vendor Rules)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.vendor_work_orders.repository import VendorWorkOrderRepository
from app.domains.vendors.models import Vendor
from app.domains.vendors.repository import VendorRepository
from app.domains.vendors.schemas import VendorCreate, VendorUpdate
from app.domains.vendors.validators import normalize_vendor_fields
from app.shared.errors import ConflictError
from app.shared.pagination import PageParams


class VendorService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = VendorRepository(session)
        self._work_orders = VendorWorkOrderRepository(session)

    async def get(self, vendor_id: uuid.UUID) -> Vendor:
        return await self._repo.get_required(vendor_id)

    async def list(
        self, *, page: PageParams, q: str | None, sort: str | None
    ) -> tuple[Sequence[Vendor], int]:
        return await self._repo.list_paginated(q=q, sort=sort, offset=page.offset, limit=page.limit)

    async def create(self, payload: VendorCreate, *, actor: uuid.UUID | None = None) -> Vendor:
        data = normalize_vendor_fields(payload.model_dump())
        vendor = Vendor(**data, created_by=actor, updated_by=actor)
        await self._repo.add(vendor)
        await self._session.commit()
        await self._session.refresh(vendor)
        return vendor

    async def update(
        self, vendor_id: uuid.UUID, payload: VendorUpdate, *, actor: uuid.UUID | None = None
    ) -> Vendor:
        vendor = await self.get(vendor_id)
        changes = normalize_vendor_fields(payload.model_dump(exclude_unset=True))
        for field, value in changes.items():
            setattr(vendor, field, value)
        vendor.updated_by = actor
        await self._session.commit()
        await self._session.refresh(vendor)
        return vendor

    async def archive(self, vendor_id: uuid.UUID, *, actor: uuid.UUID | None = None) -> None:
        """Soft delete (business_rules.md: Vendors cannot be permanently deleted)."""
        vendor = await self.get(vendor_id)
        active = await self._work_orders.count_active_by_vendor(vendor_id)
        if active > 0:
            raise ConflictError("Vendors with active Vendor Work Orders cannot be archived.")
        if vendor.archived_at is None:
            vendor.archived_at = datetime.now(UTC)
            vendor.updated_by = actor
            await self._session.commit()
