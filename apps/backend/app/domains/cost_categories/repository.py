"""Cost Category data access. Persistence only — no business logic."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_categories.models import CostCategory
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": CostCategory.created_at,
    "updated_at": CostCategory.updated_at,
    "name": CostCategory.name,
    "display_order": CostCategory.display_order,
}


class CostCategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, category_id: uuid.UUID) -> CostCategory | None:
        stmt = select(CostCategory).where(
            CostCategory.id == category_id, CostCategory.archived_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, category_id: uuid.UUID) -> CostCategory:
        from app.shared.errors import NotFoundError

        category = await self.get_by_id(category_id)
        if category is None:
            raise NotFoundError("Cost Category not found.")
        return category

    async def exists(self, category_id: uuid.UUID) -> bool:
        stmt = select(CostCategory.id).where(
            CostCategory.id == category_id, CostCategory.archived_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_by_event_and_name(self, event_id: uuid.UUID, name: str) -> CostCategory | None:
        stmt = select(CostCategory).where(
            CostCategory.event_id == event_id,
            CostCategory.name == name,
            CostCategory.archived_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_non_archived_by_event(self, event_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(CostCategory)
            .where(CostCategory.event_id == event_id, CostCategory.archived_at.is_(None))
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def list_paginated(
        self,
        *,
        q: str | None,
        sort: str | None,
        offset: int,
        limit: int,
        event_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[CostCategory], int]:
        conditions: list[Any] = [CostCategory.archived_at.is_(None)]
        if event_id is not None:
            conditions.append(CostCategory.event_id == event_id)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(func.lower(CostCategory.name).like(term))

        count_stmt = select(func.count()).select_from(CostCategory).where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=CostCategory.display_order.asc())
        stmt = (
            select(CostCategory).where(*conditions).order_by(*order_by).offset(offset).limit(limit)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, category: CostCategory) -> None:
        self._session.add(category)
        await self._session.flush()
