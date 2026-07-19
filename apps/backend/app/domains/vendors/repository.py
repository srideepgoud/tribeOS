"""Vendor data access. Persistence only — no business logic."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.vendors.models import Vendor
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": Vendor.created_at,
    "updated_at": Vendor.updated_at,
    "company_name": Vendor.company_name,
}


class VendorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, vendor_id: uuid.UUID) -> Vendor | None:
        stmt = select(Vendor).where(Vendor.id == vendor_id, Vendor.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, vendor_id: uuid.UUID) -> Vendor:
        from app.shared.errors import NotFoundError

        vendor = await self.get_by_id(vendor_id)
        if vendor is None:
            raise NotFoundError("Vendor not found.")
        return vendor

    async def exists(self, vendor_id: uuid.UUID) -> bool:
        stmt = select(Vendor.id).where(Vendor.id == vendor_id, Vendor.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def list_paginated(
        self, *, q: str | None, sort: str | None, offset: int, limit: int
    ) -> tuple[Sequence[Vendor], int]:
        conditions: list[Any] = [Vendor.archived_at.is_(None)]
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(Vendor.company_name).like(term),
                    func.lower(Vendor.contact_name).like(term),
                    func.lower(Vendor.email).like(term),
                    func.lower(Vendor.phone).like(term),
                    func.lower(Vendor.gst_number).like(term),
                    func.lower(Vendor.pan_number).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(Vendor).where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=Vendor.created_at.desc())
        stmt = select(Vendor).where(*conditions).order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, vendor: Vendor) -> None:
        self._session.add(vendor)
        await self._session.flush()
