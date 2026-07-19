"""Vendor Work Order data access. Persistence only — no business logic."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.vendor_work_orders.models import VendorWorkOrder, VendorWorkOrderStatus
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": VendorWorkOrder.created_at,
    "updated_at": VendorWorkOrder.updated_at,
    "work_order_number": VendorWorkOrder.work_order_number,
    "agreed_amount": VendorWorkOrder.agreed_amount,
    "status": VendorWorkOrder.status,
    "issue_date": VendorWorkOrder.issue_date,
}

# Phase 6 locked: active = Draft | Approved | Issued | In Progress
ACTIVE_STATUSES: tuple[VendorWorkOrderStatus, ...] = (
    VendorWorkOrderStatus.DRAFT,
    VendorWorkOrderStatus.APPROVED,
    VendorWorkOrderStatus.ISSUED,
    VendorWorkOrderStatus.IN_PROGRESS,
)


class VendorWorkOrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, work_order_id: uuid.UUID) -> VendorWorkOrder | None:
        stmt = select(VendorWorkOrder).where(VendorWorkOrder.id == work_order_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, work_order_id: uuid.UUID) -> VendorWorkOrder:
        from app.shared.errors import NotFoundError

        work_order = await self.get_by_id(work_order_id)
        if work_order is None:
            raise NotFoundError("Vendor Work Order not found.")
        return work_order

    async def exists(self, work_order_id: uuid.UUID) -> bool:
        stmt = select(VendorWorkOrder.id).where(VendorWorkOrder.id == work_order_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def count_active_by_cost_item(
        self, cost_item_id: uuid.UUID, *, exclude_id: uuid.UUID | None = None
    ) -> int:
        conditions: list[Any] = [
            VendorWorkOrder.cost_item_id == cost_item_id,
            VendorWorkOrder.status.in_(ACTIVE_STATUSES),
        ]
        if exclude_id is not None:
            conditions.append(VendorWorkOrder.id != exclude_id)
        stmt = select(func.count()).select_from(VendorWorkOrder).where(*conditions)
        return int((await self._session.execute(stmt)).scalar_one())

    async def count_active_by_vendor(self, vendor_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(VendorWorkOrder)
            .where(
                VendorWorkOrder.vendor_id == vendor_id,
                VendorWorkOrder.status.in_(ACTIVE_STATUSES),
            )
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def list_paginated(
        self,
        *,
        q: str | None,
        sort: str | None,
        offset: int,
        limit: int,
        vendor_id: uuid.UUID | None = None,
        cost_item_id: uuid.UUID | None = None,
        status: VendorWorkOrderStatus | None = None,
    ) -> tuple[Sequence[VendorWorkOrder], int]:
        conditions: list[Any] = []
        if vendor_id is not None:
            conditions.append(VendorWorkOrder.vendor_id == vendor_id)
        if cost_item_id is not None:
            conditions.append(VendorWorkOrder.cost_item_id == cost_item_id)
        if status is not None:
            conditions.append(VendorWorkOrder.status == status)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(VendorWorkOrder.work_order_number).like(term),
                    func.lower(VendorWorkOrder.scope).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(VendorWorkOrder)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=VendorWorkOrder.created_at.desc())
        stmt = select(VendorWorkOrder)
        if conditions:
            stmt = stmt.where(*conditions)
        stmt = stmt.order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, work_order: VendorWorkOrder) -> None:
        self._session.add(work_order)
        await self._session.flush()
