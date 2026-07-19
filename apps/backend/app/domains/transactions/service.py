"""Transaction business logic: ledger lifecycle, immutability, actuals.

Follows ADR 0008 / 0010 / 0011 and Phase 7 locked decisions.
``recompute_actual_amount`` is the single canonical materialization path.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_items.repository import CostItemRepository
from app.domains.events.models import EventStatus
from app.domains.events.repository import EventRepository
from app.domains.transactions.models import (
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.domains.transactions.repository import TransactionRepository
from app.domains.transactions.schemas import TransactionCreate, TransactionUpdate
from app.domains.transactions.validators import normalize_transaction_fields
from app.domains.vendor_work_orders.repository import VendorWorkOrderRepository
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams

ALLOWED_TRANSITIONS: dict[TransactionStatus, set[TransactionStatus]] = {
    TransactionStatus.PENDING: {TransactionStatus.COMPLETED, TransactionStatus.FAILED},
    TransactionStatus.FAILED: {TransactionStatus.PENDING},
    TransactionStatus.COMPLETED: {TransactionStatus.REVERSED},
    TransactionStatus.REVERSED: set(),
}

_PHASE7_CREATE_TYPES = frozenset({TransactionType.VENDOR_PAYMENT, TransactionType.INTERNAL_EXPENSE})

_BLOCKED_EVENT_STATUSES = frozenset({EventStatus.CANCELLED, EventStatus.CLOSED})

_PENDING_EDITABLE = frozenset(
    {
        "cost_item_id",
        "work_order_id",
        "payment_method",
        "amount",
        "transaction_date",
        "reference_number",
        "remarks",
    }
)


class TransactionService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = TransactionRepository(session)
        self._events = EventRepository(session)
        self._cost_items = CostItemRepository(session)
        self._work_orders = VendorWorkOrderRepository(session)

    async def get(self, transaction_id: uuid.UUID) -> Transaction:
        return await self._repo.get_required(transaction_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        event_id: uuid.UUID | None = None,
        cost_item_id: uuid.UUID | None = None,
        work_order_id: uuid.UUID | None = None,
        transaction_type: TransactionType | None = None,
        status: TransactionStatus | None = None,
    ) -> tuple[Sequence[Transaction], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            event_id=event_id,
            cost_item_id=cost_item_id,
            work_order_id=work_order_id,
            transaction_type=transaction_type,
            status=status,
        )

    async def create(
        self, payload: TransactionCreate, *, actor: uuid.UUID | None = None
    ) -> Transaction:
        data = normalize_transaction_fields(payload.model_dump())
        txn_type: TransactionType = data["transaction_type"]
        if txn_type not in _PHASE7_CREATE_TYPES:
            raise DomainValidationError(
                "Phase 7 only allows Vendor Payment and Internal Expense creation."
            )

        await self._require_operational_event(data["event_id"])
        await self._require_non_archived_cost_item(data["cost_item_id"])
        await self._assert_type_rules(
            txn_type=txn_type,
            work_order_id=data.get("work_order_id"),
            cost_item_id=data["cost_item_id"],
        )

        transaction = Transaction(
            event_id=data["event_id"],
            cost_item_id=data["cost_item_id"],
            work_order_id=data.get("work_order_id"),
            client_invoice_id=None,
            reverses_transaction_id=None,
            transaction_type=txn_type,
            payment_method=data["payment_method"],
            amount=Decimal(data["amount"]),
            transaction_date=data["transaction_date"],
            reference_number=data.get("reference_number"),
            remarks=data.get("remarks"),
            status=TransactionStatus.PENDING,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(transaction)
        await self._session.commit()
        await self._session.refresh(transaction)
        return transaction

    async def update(
        self,
        transaction_id: uuid.UUID,
        payload: TransactionUpdate,
        *,
        actor: uuid.UUID | None = None,
    ) -> Transaction:
        """Pending field updates only. Never changes ``status`` or immutable identity fields."""
        transaction = await self.get(transaction_id)
        if transaction.status != TransactionStatus.PENDING:
            raise InvalidStateError("Only Pending Transactions can be edited.")

        changes = normalize_transaction_fields(
            payload.model_dump(exclude_unset=True, exclude={"status"})
        )
        disallowed = set(changes.keys()) - _PENDING_EDITABLE
        if disallowed:
            raise DomainValidationError(
                f"Cannot update fields on a Pending Transaction: {', '.join(sorted(disallowed))}."
            )
        if not changes:
            return transaction

        cost_item_id = changes.get("cost_item_id", transaction.cost_item_id)
        work_order_id = changes.get("work_order_id", transaction.work_order_id)
        if cost_item_id is None:
            raise DomainValidationError("cost_item_id is required for Phase 7 transaction types.")
        if "cost_item_id" in changes:
            await self._require_non_archived_cost_item(cost_item_id)
        await self._assert_type_rules(
            txn_type=transaction.transaction_type,
            work_order_id=work_order_id,
            cost_item_id=cost_item_id,
        )

        for field, value in changes.items():
            setattr(transaction, field, value)
        transaction.updated_by = actor
        await self._session.commit()
        await self._session.refresh(transaction)
        return transaction

    async def transition_status(
        self,
        transaction_id: uuid.UUID,
        new_status: TransactionStatus,
        *,
        actor: uuid.UUID | None = None,
    ) -> Transaction:
        transaction = await self.get(transaction_id)
        current = transaction.status
        if new_status == current:
            return transaction

        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise InvalidStateError(
                f"Cannot transition Transaction from {current.value} to {new_status.value}."
            )

        if new_status == TransactionStatus.REVERSED:
            return await self._reverse(transaction, actor=actor)

        transaction.status = new_status
        transaction.updated_by = actor
        await self._session.flush()

        if new_status == TransactionStatus.COMPLETED and transaction.cost_item_id is not None:
            await self.recompute_actual_amount(transaction.cost_item_id)

        await self._session.commit()
        await self._session.refresh(transaction)
        return transaction

    async def recompute_actual_amount(self, cost_item_id: uuid.UUID) -> Decimal:
        """Canonical materialization (ADR 0008). Full recompute — never incremental."""
        total = await self._repo.sum_completed_amounts_for_cost_item(cost_item_id)
        item = await self._cost_items.get_required(cost_item_id)
        await self._cost_items.set_actual_amount(item, total)
        return total

    async def _reverse(self, original: Transaction, *, actor: uuid.UUID | None) -> Transaction:
        if original.transaction_type == TransactionType.REVERSAL:
            raise DomainValidationError("A Reversal transaction cannot itself be reversed.")
        if original.status != TransactionStatus.COMPLETED:
            raise InvalidStateError("Only Completed Transactions can be reversed.")
        if await self._repo.count_reversals_of(original.id) > 0:
            raise ConflictError("This Transaction has already been reversed.")

        await self._require_operational_event(original.event_id)

        reversal = Transaction(
            event_id=original.event_id,
            cost_item_id=original.cost_item_id,
            work_order_id=original.work_order_id,
            client_invoice_id=original.client_invoice_id,
            reverses_transaction_id=original.id,
            transaction_type=TransactionType.REVERSAL,
            payment_method=original.payment_method,
            amount=-original.amount,
            transaction_date=original.transaction_date,
            reference_number=original.reference_number,
            remarks=f"Reversal of {original.id}",
            status=TransactionStatus.COMPLETED,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(reversal)

        original.status = TransactionStatus.REVERSED
        original.updated_by = actor
        await self._session.flush()

        if original.cost_item_id is not None:
            await self.recompute_actual_amount(original.cost_item_id)

        await self._session.commit()
        await self._session.refresh(original)
        return original

    async def _require_operational_event(self, event_id: uuid.UUID) -> None:
        event = await self._events.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Event not found.")
        if event.status in _BLOCKED_EVENT_STATUSES:
            raise InvalidStateError(
                f"Transactions cannot be recorded while the Event is {event.status.value}."
            )

    async def _require_non_archived_cost_item(self, cost_item_id: uuid.UUID) -> None:
        item = await self._cost_items.get_by_id(cost_item_id)
        if item is None:
            raise NotFoundError("Cost Item not found.")

    async def _assert_type_rules(
        self,
        *,
        txn_type: TransactionType,
        work_order_id: uuid.UUID | None,
        cost_item_id: uuid.UUID,
    ) -> None:
        if txn_type == TransactionType.VENDOR_PAYMENT:
            if work_order_id is None:
                raise DomainValidationError("Vendor Payments require a Vendor Work Order.")
            work_order = await self._work_orders.get_by_id(work_order_id)
            if work_order is None:
                raise NotFoundError("Vendor Work Order not found.")
            if work_order.cost_item_id != cost_item_id:
                raise DomainValidationError(
                    "transaction.cost_item_id must equal work_order.cost_item_id."
                )
        elif txn_type == TransactionType.INTERNAL_EXPENSE:
            if work_order_id is not None:
                raise DomainValidationError(
                    "Internal Expenses must not reference a Vendor Work Order."
                )
