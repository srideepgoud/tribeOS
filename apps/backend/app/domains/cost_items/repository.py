"""Cost Item data access. Persistence only — no business logic."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_items.models import CostItem, CostItemStatus, CostItemVersion
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": CostItem.created_at,
    "updated_at": CostItem.updated_at,
    "title": CostItem.title,
    "budget_amount": CostItem.budget_amount,
    "status": CostItem.status,
}


class CostItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, item_id: uuid.UUID) -> CostItem | None:
        stmt = select(CostItem).where(CostItem.id == item_id, CostItem.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, item_id: uuid.UUID) -> CostItem:
        from app.shared.errors import NotFoundError

        item = await self.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Cost Item not found.")
        return item

    async def exists(self, item_id: uuid.UUID) -> bool:
        stmt = select(CostItem.id).where(CostItem.id == item_id, CostItem.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def count_non_archived_by_category(self, category_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(CostItem)
            .where(CostItem.category_id == category_id, CostItem.archived_at.is_(None))
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def count_non_archived_by_event(self, event_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(CostItem)
            .where(CostItem.event_id == event_id, CostItem.archived_at.is_(None))
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def next_version_number(self, cost_item_id: uuid.UUID) -> int:
        stmt = select(func.coalesce(func.max(CostItemVersion.version_number), 0)).where(
            CostItemVersion.cost_item_id == cost_item_id
        )
        current = int((await self._session.execute(stmt)).scalar_one())
        return current + 1

    async def list_versions(self, cost_item_id: uuid.UUID) -> Sequence[CostItemVersion]:
        stmt = (
            select(CostItemVersion)
            .where(CostItemVersion.cost_item_id == cost_item_id)
            .order_by(CostItemVersion.version_number.desc())
        )
        return (await self._session.execute(stmt)).scalars().all()

    async def list_paginated(
        self,
        *,
        q: str | None,
        sort: str | None,
        offset: int,
        limit: int,
        event_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        status: CostItemStatus | None = None,
    ) -> tuple[Sequence[CostItem], int]:
        conditions: list[Any] = [CostItem.archived_at.is_(None)]
        if event_id is not None:
            conditions.append(CostItem.event_id == event_id)
        if category_id is not None:
            conditions.append(CostItem.category_id == category_id)
        if status is not None:
            conditions.append(CostItem.status == status)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(CostItem.title).like(term),
                    func.lower(CostItem.description).like(term),
                    func.lower(CostItem.notes).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(CostItem).where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=CostItem.created_at.desc())
        stmt = select(CostItem).where(*conditions).order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, item: CostItem) -> None:
        self._session.add(item)
        await self._session.flush()

    async def add_version(self, version: CostItemVersion) -> None:
        self._session.add(version)
        await self._session.flush()
