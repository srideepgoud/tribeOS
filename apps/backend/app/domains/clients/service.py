"""Client business logic. Owns validation orchestration, transactions, and the
soft-delete policy (see business_rules.md — Client Rules). Routers stay thin;
repositories stay persistence-only.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.models import Client
from app.domains.clients.repository import ClientRepository
from app.domains.clients.schemas import ClientCreate, ClientUpdate
from app.domains.clients.validators import normalize_client_fields
from app.domains.events.repository import EventRepository
from app.shared.errors import ConflictError, NotFoundError
from app.shared.pagination import PageParams


class ClientService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = ClientRepository(session)

    async def get(self, client_id: uuid.UUID) -> Client:
        client = await self._repo.get_by_id(client_id)
        if client is None:
            raise NotFoundError("Client not found.")
        return client

    async def list(
        self, *, page: PageParams, q: str | None, sort: str | None
    ) -> tuple[Sequence[Client], int]:
        return await self._repo.list_paginated(q=q, sort=sort, offset=page.offset, limit=page.limit)

    async def create(self, payload: ClientCreate, *, actor: uuid.UUID | None = None) -> Client:
        data = normalize_client_fields(payload.model_dump())
        client = Client(**data, created_by=actor, updated_by=actor)
        await self._repo.add(client)
        await self._session.commit()
        await self._session.refresh(client)
        return client

    async def update(
        self, client_id: uuid.UUID, payload: ClientUpdate, *, actor: uuid.UUID | None = None
    ) -> Client:
        client = await self.get(client_id)
        changes = normalize_client_fields(payload.model_dump(exclude_unset=True))
        for field, value in changes.items():
            setattr(client, field, value)
        client.updated_by = actor
        await self._session.commit()
        await self._session.refresh(client)
        return client

    async def archive(self, client_id: uuid.UUID, *, actor: uuid.UUID | None = None) -> None:
        """Soft delete (business_rules.md: Clients are never permanently deleted).

        A client cannot be archived while non-archived Events exist.
        """
        client = await self.get(client_id)
        event_count = await EventRepository(self._session).count_non_archived_by_client(client_id)
        if event_count > 0:
            raise ConflictError(
                "Cannot archive client while non-archived events exist.",
            )
        if client.archived_at is None:
            client.archived_at = datetime.now(UTC)
            client.updated_by = actor
            await self._session.commit()
