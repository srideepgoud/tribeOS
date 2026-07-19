"""Event data access. Persistence only — no business logic (see ARCHITECTURE.md).

Archived events (``archived_at IS NOT NULL``) are excluded from reads unless
noted. Method names use storage concepts (non-archived), not business phrases
like "active".
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.events.models import Event, EventStatus
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": Event.created_at,
    "updated_at": Event.updated_at,
    "name": Event.name,
    "start_datetime": Event.start_datetime,
    "status": Event.status,
}


class EventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, event_id: uuid.UUID) -> Event | None:
        stmt = select(Event).where(Event.id == event_id, Event.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, event_id: uuid.UUID) -> Event:
        """Return a non-archived event or raise ``NotFoundError``.

        Future domains (Cost Categories, Work Orders, …) should reuse this.
        """
        from app.shared.errors import NotFoundError

        event = await self.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Event not found.")
        return event

    async def exists(self, event_id: uuid.UUID) -> bool:
        stmt = select(Event.id).where(Event.id == event_id, Event.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def count_non_archived_by_client(self, client_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(Event)
            .where(Event.client_id == client_id, Event.archived_at.is_(None))
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def list_paginated(
        self,
        *,
        q: str | None,
        sort: str | None,
        offset: int,
        limit: int,
        status: EventStatus | None = None,
        client_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[Event], int]:
        conditions: list[Any] = [Event.archived_at.is_(None)]
        if status is not None:
            conditions.append(Event.status == status)
        if client_id is not None:
            conditions.append(Event.client_id == client_id)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(Event.name).like(term),
                    func.lower(Event.venue).like(term),
                    func.lower(Event.city).like(term),
                    func.lower(Event.notes).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(Event).where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=Event.created_at.desc())
        stmt = select(Event).where(*conditions).order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, event: Event) -> None:
        self._session.add(event)
        await self._session.flush()
