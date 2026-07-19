"""Cost Category business logic (docs/business_rules.md — Cost Category Rules)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_categories.models import CostCategory
from app.domains.cost_categories.repository import CostCategoryRepository
from app.domains.cost_categories.schemas import CostCategoryCreate, CostCategoryUpdate
from app.domains.cost_categories.validators import normalize_cost_category_fields
from app.domains.events.repository import EventRepository
from app.shared.errors import ConflictError, NotFoundError
from app.shared.pagination import PageParams


class CostCategoryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CostCategoryRepository(session)
        self._events = EventRepository(session)

    async def get(self, category_id: uuid.UUID) -> CostCategory:
        return await self._repo.get_required(category_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        event_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[CostCategory], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            event_id=event_id,
        )

    async def create(
        self, payload: CostCategoryCreate, *, actor: uuid.UUID | None = None
    ) -> CostCategory:
        data = normalize_cost_category_fields(payload.model_dump())
        await self._require_non_archived_event(data["event_id"])
        await self._assert_unique_name(data["event_id"], data["name"])

        category = CostCategory(**data, created_by=actor, updated_by=actor)
        await self._repo.add(category)
        await self._session.commit()
        await self._session.refresh(category)
        return category

    async def update(
        self,
        category_id: uuid.UUID,
        payload: CostCategoryUpdate,
        *,
        actor: uuid.UUID | None = None,
    ) -> CostCategory:
        category = await self.get(category_id)
        changes = normalize_cost_category_fields(payload.model_dump(exclude_unset=True))
        if not changes:
            return category

        event_id = changes.get("event_id", category.event_id)
        if "event_id" in changes:
            await self._require_non_archived_event(event_id)

        name = changes.get("name", category.name)
        if "name" in changes or "event_id" in changes:
            await self._assert_unique_name(event_id, name, exclude_id=category.id)

        for field, value in changes.items():
            setattr(category, field, value)
        category.updated_by = actor
        await self._session.commit()
        await self._session.refresh(category)
        return category

    async def archive(self, category_id: uuid.UUID, *, actor: uuid.UUID | None = None) -> None:
        """Soft delete (archive only).

        Deferred rule: "Categories cannot be deleted while Cost Items exist."
        Enforced when the Cost Items module exists; until then there are no Cost
        Items to block archival.
        """
        category = await self.get(category_id)
        if category.archived_at is None:
            category.archived_at = datetime.now(UTC)
            category.updated_by = actor
            await self._session.commit()

    async def _require_non_archived_event(self, event_id: uuid.UUID) -> None:
        event = await self._events.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Event not found.")

    async def _assert_unique_name(
        self,
        event_id: uuid.UUID,
        name: str,
        *,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        existing = await self._repo.get_by_event_and_name(event_id, name)
        if existing is not None and existing.id != exclude_id:
            raise ConflictError("Category names must be unique within an event.")
