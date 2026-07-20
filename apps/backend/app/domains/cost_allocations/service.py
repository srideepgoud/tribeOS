"""Internal Cost Allocation helpers.

Callable only from TransactionService (ADR 0009 / 0012).
Does not expose HTTP. Does not recompute actual_amount — that stays on TransactionService.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_allocations.models import AttributionState, CostAllocation
from app.domains.cost_allocations.repository import CostAllocationRepository
from app.domains.cost_allocations.schemas import AttributionSummary, CostAllocationLine
from app.domains.cost_allocations.validators import normalize_allocation_lines
from app.domains.cost_items.repository import CostItemRepository
from app.domains.transactions.models import Transaction
from app.shared.errors import ConflictError, DomainValidationError, NotFoundError


class CostAllocationHelper:
    """Validates and replaces allocation sets for a Transaction aggregate."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CostAllocationRepository(session)
        self._cost_items = CostItemRepository(session)

    async def list_for_transaction(self, transaction_id: uuid.UUID) -> Sequence[CostAllocation]:
        return await self._repo.list_by_transaction(transaction_id)

    async def attribution_summary(self, transaction: Transaction) -> AttributionSummary:
        total = await self._repo.sum_for_transaction(transaction.id)
        amount = Decimal(str(transaction.amount))
        # Cash amounts on reversals are negative; compare using absolute for state.
        target = abs(amount)
        allocated = total
        unattributed = max(target - allocated, Decimal("0"))
        state = self.derive_state(allocated_total=allocated, transaction_amount=target)
        return AttributionSummary(
            state=state,
            allocated_total=allocated,
            transaction_amount=amount,
            unattributed_amount=unattributed,
        )

    @staticmethod
    def derive_state(*, allocated_total: Decimal, transaction_amount: Decimal) -> AttributionState:
        target = abs(transaction_amount)
        if allocated_total == 0:
            return AttributionState.UNATTRIBUTED
        if allocated_total < target:
            return AttributionState.PARTIALLY_ATTRIBUTED
        if allocated_total == target:
            return AttributionState.FULLY_ATTRIBUTED
        raise DomainValidationError("Allocated total exceeds Transaction amount.")

    async def replace_allocations(
        self,
        transaction: Transaction,
        lines: list[CostAllocationLine] | list[dict],
    ) -> Sequence[CostAllocation]:
        """Replace the full allocation set. Caller enforces Event Closed / status gates."""
        normalized = normalize_allocation_lines(
            [line.model_dump() if hasattr(line, "model_dump") else dict(line) for line in lines]
        )
        await self._validate_lines(transaction, normalized)
        await self._repo.delete_for_transaction(transaction.id)
        allocations = [
            CostAllocation(
                transaction_id=transaction.id,
                cost_item_id=row["cost_item_id"],
                allocated_amount=Decimal(str(row["allocated_amount"])),
            )
            for row in normalized
        ]
        if allocations:
            await self._repo.add_many(allocations)
        return await self._repo.list_by_transaction(transaction.id)

    async def materialize_single_from_header(self, transaction: Transaction) -> CostAllocation:
        """SHALL create exactly one allocation from header cost_item_id (ADR 0012)."""
        if transaction.cost_item_id is None:
            raise DomainValidationError(
                "Cannot materialize allocation without Transaction.cost_item_id."
            )
        existing = await self._repo.list_by_transaction(transaction.id)
        if existing:
            raise ConflictError("Allocations already exist; auto-materialization skipped.")
        await self._require_non_archived_cost_item(transaction.cost_item_id)
        allocation = CostAllocation(
            transaction_id=transaction.id,
            cost_item_id=transaction.cost_item_id,
            allocated_amount=abs(Decimal(str(transaction.amount))),
        )
        await self._repo.add(allocation)
        return allocation

    async def _validate_lines(
        self, transaction: Transaction, lines: list[dict]
    ) -> None:
        seen: set[uuid.UUID] = set()
        total = Decimal("0")
        target = abs(Decimal(str(transaction.amount)))

        for row in lines:
            cost_item_id = row["cost_item_id"]
            amount = Decimal(str(row["allocated_amount"]))
            if amount <= 0:
                raise DomainValidationError("allocated_amount must be greater than zero.")
            if cost_item_id in seen:
                raise ConflictError(
                    "Duplicate Cost Item is not allowed within one Transaction's allocations."
                )
            seen.add(cost_item_id)
            await self._require_non_archived_cost_item(cost_item_id)
            total += amount

        if total > target:
            raise DomainValidationError(
                "Total allocated amount cannot exceed Transaction amount."
            )

    async def _require_non_archived_cost_item(self, cost_item_id: uuid.UUID) -> None:
        item = await self._cost_items.get_by_id(cost_item_id)
        if item is None:
            raise NotFoundError("Cost Item not found.")
