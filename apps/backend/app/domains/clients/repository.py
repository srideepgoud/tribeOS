"""Client data access. Persistence only — no business logic (see ARCHITECTURE.md).

Archived clients (``archived_at IS NOT NULL``) are excluded from all reads.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.models import Client
from app.shared.sorting import build_order_by

# Whitelisted sortable fields (see api_contract.md — only whitelisted fields).
_SORTABLE = {
    "created_at": Client.created_at,
    "updated_at": Client.updated_at,
    "company_name": Client.company_name,
}


class ClientRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, client_id: uuid.UUID) -> Client | None:
        stmt = select(Client).where(Client.id == client_id, Client.archived_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_paginated(
        self, *, q: str | None, sort: str | None, offset: int, limit: int
    ) -> tuple[Sequence[Client], int]:
        conditions: list[Any] = [Client.archived_at.is_(None)]
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(Client.company_name).like(term),
                    func.lower(Client.email).like(term),
                    func.lower(Client.phone).like(term),
                    func.lower(Client.gst_number).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(Client).where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=Client.created_at.desc())
        stmt = select(Client).where(*conditions).order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, client: Client) -> None:
        self._session.add(client)
        await self._session.flush()
