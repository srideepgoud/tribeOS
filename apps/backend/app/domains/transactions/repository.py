"""Transaction data access. Persistence only — no business logic."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.transactions.models import Transaction, TransactionStatus, TransactionType
from app.shared.sorting import build_order_by

_SORTABLE = {
    "created_at": Transaction.created_at,
    "updated_at": Transaction.updated_at,
    "transaction_date": Transaction.transaction_date,
    "amount": Transaction.amount,
    "status": Transaction.status,
    "transaction_type": Transaction.transaction_type,
}


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, transaction_id: uuid.UUID) -> Transaction | None:
        stmt = select(Transaction).where(Transaction.id == transaction_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required(self, transaction_id: uuid.UUID) -> Transaction:
        from app.shared.errors import NotFoundError

        transaction = await self.get_by_id(transaction_id)
        if transaction is None:
            raise NotFoundError("Transaction not found.")
        return transaction

    async def count_reversals_of(self, original_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.reverses_transaction_id == original_id)
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def sum_completed_amounts_for_cost_item(self, cost_item_id: uuid.UUID) -> Decimal:
        """Authoritative spend: sum Completed non-reversal amounts for the Cost Item.

        Reversed originals are excluded by status. Reversal rows are audit entries
        (linked via reverses_transaction_id) and are excluded by type so impact is
        not double-counted. Pending and Failed are excluded.
        """
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.cost_item_id == cost_item_id,
            Transaction.status == TransactionStatus.COMPLETED,
            Transaction.transaction_type != TransactionType.REVERSAL,
        )
        value = (await self._session.execute(stmt)).scalar_one()
        return Decimal(str(value))

    async def list_paginated(
        self,
        *,
        q: str | None,
        sort: str | None,
        offset: int,
        limit: int,
        event_id: uuid.UUID | None = None,
        cost_item_id: uuid.UUID | None = None,
        work_order_id: uuid.UUID | None = None,
        transaction_type: TransactionType | None = None,
        status: TransactionStatus | None = None,
    ) -> tuple[Sequence[Transaction], int]:
        conditions: list[Any] = []
        if event_id is not None:
            conditions.append(Transaction.event_id == event_id)
        if cost_item_id is not None:
            conditions.append(Transaction.cost_item_id == cost_item_id)
        if work_order_id is not None:
            conditions.append(Transaction.work_order_id == work_order_id)
        if transaction_type is not None:
            conditions.append(Transaction.transaction_type == transaction_type)
        if status is not None:
            conditions.append(Transaction.status == status)
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(Transaction.reference_number).like(term),
                    func.lower(Transaction.remarks).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(Transaction)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())

        order_by = build_order_by(sort, _SORTABLE, default=Transaction.created_at.desc())
        stmt = select(Transaction)
        if conditions:
            stmt = stmt.where(*conditions)
        stmt = stmt.order_by(*order_by).offset(offset).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return rows, total

    async def add(self, transaction: Transaction) -> None:
        self._session.add(transaction)
        await self._session.flush()
