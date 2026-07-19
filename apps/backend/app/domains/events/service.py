"""Event business logic: lifecycle, archive policy, client association.

Status is a state machine — never applied as a plain field update. See
``docs/state_machine.md`` and ``docs/business_rules.md``.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.repository import ClientRepository
from app.domains.events.models import Event, EventStatus
from app.domains.events.repository import EventRepository
from app.domains.events.schemas import EventCreate, EventUpdate
from app.domains.events.validators import normalize_event_fields
from app.shared.errors import DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams

# Single source of truth for Event transitions (docs/state_machine.md).
ALLOWED_TRANSITIONS: dict[EventStatus, set[EventStatus]] = {
    EventStatus.DRAFT: {EventStatus.PLANNING, EventStatus.CANCELLED},
    EventStatus.PLANNING: {EventStatus.COMMERCIALS, EventStatus.CANCELLED},
    EventStatus.COMMERCIALS: {EventStatus.PROCUREMENT, EventStatus.CANCELLED},
    EventStatus.PROCUREMENT: {EventStatus.EXECUTION, EventStatus.CANCELLED},
    EventStatus.EXECUTION: {EventStatus.SETTLEMENT},
    EventStatus.SETTLEMENT: {EventStatus.CLOSED},
    EventStatus.CLOSED: set(),
    EventStatus.CANCELLED: set(),
}


class EventService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = EventRepository(session)
        self._clients = ClientRepository(session)

    async def get(self, event_id: uuid.UUID) -> Event:
        return await self._repo.get_required(event_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        status: EventStatus | None = None,
        client_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[Event], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            status=status,
            client_id=client_id,
        )

    async def create(self, payload: EventCreate, *, actor: uuid.UUID | None = None) -> Event:
        data = normalize_event_fields(payload.model_dump())
        await self._require_non_archived_client(data["client_id"])
        self._validate_datetimes(data.get("start_datetime"), data.get("end_datetime"))

        event = Event(
            **data,
            status=EventStatus.DRAFT,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(event)
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def update(
        self, event_id: uuid.UUID, payload: EventUpdate, *, actor: uuid.UUID | None = None
    ) -> Event:
        """Apply field updates only. Never changes ``status``."""
        event = await self.get(event_id)
        self._assert_mutable(event)

        changes = normalize_event_fields(payload.model_dump(exclude_unset=True, exclude={"status"}))
        if not changes:
            return event

        if "client_id" in changes:
            await self._require_non_archived_client(changes["client_id"])

        start = changes.get("start_datetime", event.start_datetime)
        end = changes.get("end_datetime", event.end_datetime)
        self._validate_datetimes(start, end)

        for field, value in changes.items():
            setattr(event, field, value)
        event.updated_by = actor
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def transition_status(
        self,
        event_id: uuid.UUID,
        new_status: EventStatus,
        *,
        actor: uuid.UUID | None = None,
    ) -> Event:
        """Sole path for status changes. Validates ``ALLOWED_TRANSITIONS``."""
        event = await self.get(event_id)
        current = event.status

        if new_status == current:
            return event

        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise InvalidStateError(self._transition_error_message(current, new_status))

        event.status = new_status
        event.updated_by = actor
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def archive(self, event_id: uuid.UUID, *, actor: uuid.UUID | None = None) -> None:
        """Soft delete. Only Draft events may be archived (business_rules.md)."""
        event = await self.get(event_id)
        if event.status != EventStatus.DRAFT:
            raise InvalidStateError("Only Draft events may be archived.")
        if event.archived_at is None:
            event.archived_at = datetime.now(UTC)
            event.updated_by = actor
            await self._session.commit()

    def _assert_mutable(self, event: Event) -> None:
        if event.status == EventStatus.CLOSED:
            raise InvalidStateError("Closed events cannot be modified.")
        if event.status == EventStatus.CANCELLED:
            raise InvalidStateError("Cancelled events cannot be modified.")

    async def _require_non_archived_client(self, client_id: uuid.UUID) -> None:
        client = await self._clients.get_by_id(client_id)
        if client is None:
            raise NotFoundError("Client not found.")

    @staticmethod
    def _validate_datetimes(start: datetime | None, end: datetime | None) -> None:
        if start is not None and end is not None and end < start:
            raise DomainValidationError(
                "end_datetime must be greater than or equal to start_datetime."
            )

    @staticmethod
    def _transition_error_message(current: EventStatus, new_status: EventStatus) -> str:
        if current == EventStatus.CLOSED:
            return "Closed events cannot be reopened."
        if current == EventStatus.CANCELLED:
            return "Cancelled events cannot change status."
        return f"Cannot transition Event from {current.value} to {new_status.value}."
