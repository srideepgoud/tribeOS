"""Client Invoice data access. Persistence only — no business logic.

Event-level financial reporting (Billed Revenue, Event Outstanding rollups)
belongs in ``FinancialSummaryService``, not this repository (ADR 0013).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.models import ClientInvoice, ClientInvoiceStatus
from app.domains.transactions.models import Transaction, TransactionStatus, TransactionType
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": ClientInvoice.created_at,
    "updated_at": ClientInvoice.updated_at,
    "invoice_number": ClientInvoice.invoice_number,
    "invoice_date": ClientInvoice.invoice_date,
    "due_date": ClientInvoice.due_date,
    "total_amount": ClientInvoice.total_amount,
    "status": ClientInvoice.status,
}


class ClientInvoiceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, invoice_id: uuid.UUID) -> ClientInvoice | None:
        stmt = select(ClientInvoice).where(ClientInvoice.id == invoice_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, invoice_id: uuid.UUID) -> ClientInvoice:
        from app.shared.errors import NotFoundError

        invoice = await self.get_by_id(invoice_id)
        if invoice is None:
            raise NotFoundError("Client Invoice not found.")
        return invoice

    async def exists(self, invoice_id: uuid.UUID) -> bool:
        stmt = select(ClientInvoice.id).where(ClientInvoice.id == invoice_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def count_by_invoice_number(
        self, invoice_number: str, *, exclude_id: uuid.UUID | None = None
    ) -> int:
        conditions: list[Any] = [ClientInvoice.invoice_number == invoice_number]
        if exclude_id is not None:
            conditions.append(ClientInvoice.id != exclude_id)
        stmt = select(func.count()).select_from(ClientInvoice).where(*conditions)
        return int((await self._session.execute(stmt)).scalar_one())

    async def list_by_event(self, event_id: uuid.UUID) -> Sequence[ClientInvoice]:
        return await self.list_by_events([event_id])

    async def list_by_events(self, event_ids: Sequence[uuid.UUID]) -> Sequence[ClientInvoice]:
        if not event_ids:
            return []
        stmt = (
            select(ClientInvoice)
            .where(ClientInvoice.event_id.in_(event_ids))
            .order_by(ClientInvoice.created_at.desc())
        )
        return (await self._session.execute(stmt)).scalars().all()

    async def list_by_client(self, client_id: uuid.UUID) -> Sequence[ClientInvoice]:
        stmt = (
            select(ClientInvoice)
            .where(ClientInvoice.client_id == client_id)
            .order_by(ClientInvoice.created_at.desc())
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
        client_id: uuid.UUID | None = None,
        status: ClientInvoiceStatus | None = None,
    ) -> tuple[Sequence[ClientInvoice], int]:
        conditions: list[Any] = []
        if event_id is not None:
            conditions.append(ClientInvoice.event_id == event_id)
        if client_id is not None:
            conditions.append(ClientInvoice.client_id == client_id)
        if status is not None:
            conditions.append(ClientInvoice.status == status)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(ClientInvoice.invoice_number).like(term),
                    func.lower(ClientInvoice.notes).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(ClientInvoice)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=ClientInvoice.created_at.desc())
        stmt = select(ClientInvoice)
        if conditions:
            stmt = stmt.where(*conditions)
        stmt = stmt.order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def sum_completed_receipts(self, invoice_id: uuid.UUID) -> Decimal:
        """Sum amounts of Completed Client Receipts for one invoice.

        Excludes Pending, Failed, and Reversed originals (status != Completed).
        Reversal rows (``transaction_type = Reversal``) are excluded by type.
        Persistence helper only — Outstanding / status derivation live in the service.
        """
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.client_invoice_id == invoice_id,
            Transaction.transaction_type == TransactionType.CLIENT_RECEIPT,
            Transaction.status == TransactionStatus.COMPLETED,
        )
        value = (await self._session.execute(stmt)).scalar_one()
        return Decimal(str(value))

    async def add(self, invoice: ClientInvoice) -> None:
        self._session.add(invoice)
        await self._session.flush()

    async def update(self, invoice: ClientInvoice) -> None:
        """Flush field mutations on an already-tracked invoice."""
        _ = invoice
        await self._session.flush()
