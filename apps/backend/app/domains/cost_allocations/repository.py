"""Cost Allocation persistence. No business logic — no actuals recomputation."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_allocations.models import CostAllocation
from app.domains.transactions.models import Transaction, TransactionStatus, TransactionType


class CostAllocationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_transaction(self, transaction_id: uuid.UUID) -> Sequence[CostAllocation]:
        stmt = (
            select(CostAllocation)
            .where(CostAllocation.transaction_id == transaction_id)
            .order_by(CostAllocation.cost_item_id)
        )
        return (await self._session.execute(stmt)).scalars().all()

    async def sum_for_transaction(self, transaction_id: uuid.UUID) -> Decimal:
        stmt = select(func.coalesce(func.sum(CostAllocation.allocated_amount), 0)).where(
            CostAllocation.transaction_id == transaction_id
        )
        value = (await self._session.execute(stmt)).scalar_one()
        return Decimal(str(value))

    async def sum_completed_allocations_for_cost_item(self, cost_item_id: uuid.UUID) -> Decimal:
        """Sum allocated amounts for Completed non-reversal Transactions.

        Reversed originals are excluded by status. Reversal rows are excluded by type.
        """
        stmt = (
            select(func.coalesce(func.sum(CostAllocation.allocated_amount), 0))
            .select_from(CostAllocation)
            .join(Transaction, Transaction.id == CostAllocation.transaction_id)
            .where(
                CostAllocation.cost_item_id == cost_item_id,
                Transaction.status == TransactionStatus.COMPLETED,
                Transaction.transaction_type != TransactionType.REVERSAL,
            )
        )
        value = (await self._session.execute(stmt)).scalar_one()
        return Decimal(str(value))

    async def sum_completed_allocations_for_event(self, event_id: uuid.UUID) -> Decimal:
        by_event = await self.sum_completed_allocations_by_event([event_id])
        return by_event.get(event_id, Decimal("0"))

    async def sum_completed_allocations_by_event(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, Decimal]:
        """Attributed Cost rollup per Event (Completed non-reversal allocations)."""
        if not event_ids:
            return {}
        stmt = (
            select(
                Transaction.event_id,
                func.coalesce(func.sum(CostAllocation.allocated_amount), 0),
            )
            .select_from(CostAllocation)
            .join(Transaction, Transaction.id == CostAllocation.transaction_id)
            .where(
                Transaction.event_id.in_(event_ids),
                Transaction.status == TransactionStatus.COMPLETED,
                Transaction.transaction_type != TransactionType.REVERSAL,
            )
            .group_by(Transaction.event_id)
        )
        rows = (await self._session.execute(stmt)).all()
        return {event_id: Decimal(str(value)) for event_id, value in rows}

    async def distinct_cost_item_ids_for_transaction(
        self, transaction_id: uuid.UUID
    ) -> Sequence[uuid.UUID]:
        stmt = select(CostAllocation.cost_item_id).where(
            CostAllocation.transaction_id == transaction_id
        )
        return (await self._session.execute(stmt)).scalars().all()

    async def delete_for_transaction(self, transaction_id: uuid.UUID) -> None:
        await self._session.execute(
            delete(CostAllocation).where(CostAllocation.transaction_id == transaction_id)
        )
        await self._session.flush()

    async def add(self, allocation: CostAllocation) -> None:
        self._session.add(allocation)
        await self._session.flush()

    async def add_many(self, allocations: Sequence[CostAllocation]) -> None:
        for allocation in allocations:
            self._session.add(allocation)
        await self._session.flush()

    async def exists_for_transaction_and_cost_item(
        self, transaction_id: uuid.UUID, cost_item_id: uuid.UUID
    ) -> bool:
        stmt = (
            select(func.count())
            .select_from(CostAllocation)
            .where(
                CostAllocation.transaction_id == transaction_id,
                CostAllocation.cost_item_id == cost_item_id,
            )
        )
        return int((await self._session.execute(stmt)).scalar_one()) > 0
