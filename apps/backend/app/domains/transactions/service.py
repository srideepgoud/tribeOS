"""Transaction business logic: ledger, attribution, actuals, Client Receipts.

ADR 0011 / 0012 / 0013. ``recompute_actual_amount`` is the canonical Attributed
Cost path. Client Receipts never use Cost Allocations.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.models import ClientInvoiceStatus
from app.domains.client_invoices.service import ClientInvoiceService
from app.domains.cost_allocations.models import CostAllocation
from app.domains.cost_allocations.repository import CostAllocationRepository
from app.domains.cost_allocations.schemas import (
    AttributionSummary,
    CostAllocationLine,
    CostAllocationReplace,
)
from app.domains.cost_allocations.service import CostAllocationHelper
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

_CREATE_TYPES = frozenset(
    {
        TransactionType.VENDOR_PAYMENT,
        TransactionType.INTERNAL_EXPENSE,
        TransactionType.CLIENT_RECEIPT,
    }
)

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
        self._allocations = CostAllocationRepository(session)
        self._allocation_helper = CostAllocationHelper(session)
        self._invoices = ClientInvoiceService(session)

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
        client_invoice_id: uuid.UUID | None = None,
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
            client_invoice_id=client_invoice_id,
            transaction_type=transaction_type,
            status=status,
        )

    async def count_pending_financial_by_type(
        self, event_id: uuid.UUID
    ) -> dict[TransactionType, int]:
        """Pending financial Transaction counts for Event Financial Close."""
        return await self._repo.count_pending_financial_by_type(event_id)

    async def count_pending_financial_by_event(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, dict[TransactionType, int]]:
        """Batched pending financial Transaction counts for dashboards / close."""
        return await self._repo.count_pending_financial_by_event(event_ids)

    async def list_allocations(self, transaction_id: uuid.UUID) -> Sequence[CostAllocation]:
        await self.get(transaction_id)
        return await self._allocation_helper.list_for_transaction(transaction_id)

    async def get_attribution_summary(self, transaction_id: uuid.UUID) -> AttributionSummary:
        transaction = await self.get(transaction_id)
        return await self._allocation_helper.attribution_summary(transaction)

    async def replace_allocations(
        self,
        transaction_id: uuid.UUID,
        payload: CostAllocationReplace,
        *,
        actor: uuid.UUID | None = None,
    ) -> Sequence[CostAllocation]:
        transaction = await self.get(transaction_id)
        if transaction.transaction_type == TransactionType.CLIENT_RECEIPT:
            raise DomainValidationError("Client Receipts do not use Cost Allocations.")
        await self._assert_allocations_mutable(transaction)
        previous_ids = list(
            await self._allocations.distinct_cost_item_ids_for_transaction(transaction.id)
        )
        rows = await self._allocation_helper.replace_allocations(
            transaction, list(payload.allocations)
        )
        affected = set(previous_ids) | {line.cost_item_id for line in payload.allocations}
        if transaction.status == TransactionStatus.COMPLETED:
            for cost_item_id in affected:
                await self.recompute_actual_amount(cost_item_id)
        transaction.updated_by = actor
        await self._session.commit()
        return rows

    async def create(
        self, payload: TransactionCreate, *, actor: uuid.UUID | None = None
    ) -> Transaction:
        data = normalize_transaction_fields(payload.model_dump())
        txn_type: TransactionType = data["transaction_type"]
        if txn_type not in _CREATE_TYPES:
            raise DomainValidationError(
                "Only Vendor Payment, Internal Expense, and Client Receipt may be created."
            )

        await self._require_operational_event(data["event_id"])
        cost_item_id = data.get("cost_item_id")
        client_invoice_id = data.get("client_invoice_id")
        allocation_lines: list[CostAllocationLine] = list(payload.allocations or [])

        if txn_type == TransactionType.CLIENT_RECEIPT:
            if allocation_lines:
                raise DomainValidationError("Client Receipts do not use Cost Allocations.")
            if cost_item_id is not None:
                raise DomainValidationError("Client Receipts must not reference a Cost Item.")
            await self._assert_client_receipt_capacity(
                event_id=data["event_id"],
                client_invoice_id=client_invoice_id,
                amount=Decimal(data["amount"]),
            )
        else:
            if client_invoice_id is not None:
                raise DomainValidationError(
                    f"{txn_type.value} must not reference a Client Invoice."
                )
            if cost_item_id is not None:
                await self._require_non_archived_cost_item(cost_item_id)
            await self._assert_type_rules(
                txn_type=txn_type,
                work_order_id=data.get("work_order_id"),
                cost_item_id=cost_item_id,
                allocation_lines=allocation_lines,
            )

        transaction = Transaction(
            event_id=data["event_id"],
            cost_item_id=cost_item_id,
            work_order_id=data.get("work_order_id"),
            client_invoice_id=client_invoice_id,
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
        await self._session.flush()

        if allocation_lines:
            await self._allocation_helper.replace_allocations(transaction, allocation_lines)

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
        await self._require_operational_event(transaction.event_id)

        changes = normalize_transaction_fields(
            payload.model_dump(exclude_unset=True, exclude={"status", "allocations"})
        )
        disallowed = set(changes.keys()) - _PENDING_EDITABLE
        if disallowed:
            raise DomainValidationError(
                f"Cannot update fields on a Pending Transaction: {', '.join(sorted(disallowed))}."
            )

        cost_item_id = changes.get("cost_item_id", transaction.cost_item_id)
        work_order_id = changes.get("work_order_id", transaction.work_order_id)
        amount = Decimal(changes["amount"]) if "amount" in changes else transaction.amount
        allocation_lines = payload.allocations

        if transaction.transaction_type == TransactionType.CLIENT_RECEIPT:
            if allocation_lines:
                raise DomainValidationError("Client Receipts do not use Cost Allocations.")
            if "cost_item_id" in changes and cost_item_id is not None:
                raise DomainValidationError("Client Receipts must not reference a Cost Item.")
            await self._assert_client_receipt_capacity(
                event_id=transaction.event_id,
                client_invoice_id=transaction.client_invoice_id,
                amount=amount,
            )
        else:
            if "cost_item_id" in changes and cost_item_id is not None:
                await self._require_non_archived_cost_item(cost_item_id)
            await self._assert_type_rules(
                txn_type=transaction.transaction_type,
                work_order_id=work_order_id,
                cost_item_id=cost_item_id,
                allocation_lines=list(allocation_lines) if allocation_lines is not None else None,
            )

        for field, value in changes.items():
            setattr(transaction, field, value)
        transaction.updated_by = actor

        if allocation_lines is not None:
            if transaction.transaction_type == TransactionType.CLIENT_RECEIPT:
                raise DomainValidationError("Client Receipts do not use Cost Allocations.")
            await self._allocation_helper.replace_allocations(transaction, list(allocation_lines))

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

        # Reversal path also checks operational Event; other transitions must not
        # mutate ledger state after Financial Close.
        if new_status != TransactionStatus.REVERSED:
            await self._require_operational_event(transaction.event_id)

        if new_status == TransactionStatus.REVERSED:
            return await self._reverse(transaction, actor=actor)

        if new_status == TransactionStatus.COMPLETED:
            if transaction.transaction_type == TransactionType.CLIENT_RECEIPT:
                await self._assert_client_receipt_capacity(
                    event_id=transaction.event_id,
                    client_invoice_id=transaction.client_invoice_id,
                    amount=transaction.amount,
                )

        transaction.status = new_status
        transaction.updated_by = actor
        await self._session.flush()

        if new_status == TransactionStatus.COMPLETED:
            await self._on_completed(transaction, actor=actor)

        await self._session.commit()
        await self._session.refresh(transaction)
        return transaction

    async def recompute_actual_amount(self, cost_item_id: uuid.UUID) -> Decimal:
        """Canonical Attributed Cost materialization (ADR 0008 / 0012). Full recompute."""
        total = await self._allocations.sum_completed_allocations_for_cost_item(cost_item_id)
        item = await self._cost_items.get_required(cost_item_id)
        await self._cost_items.set_actual_amount(item, total)
        return total

    async def _on_completed(
        self, transaction: Transaction, *, actor: uuid.UUID | None = None
    ) -> None:
        if transaction.transaction_type == TransactionType.CLIENT_RECEIPT:
            assert transaction.client_invoice_id is not None
            await self._invoices.recalculate_after_receipt_change(
                transaction.client_invoice_id, actor=actor
            )
            return

        existing = await self._allocations.list_by_transaction(transaction.id)
        if not existing and transaction.cost_item_id is not None:
            await self._allocation_helper.materialize_single_from_header(transaction)
            existing = await self._allocations.list_by_transaction(transaction.id)

        affected = {row.cost_item_id for row in existing}
        if transaction.cost_item_id is not None:
            affected.add(transaction.cost_item_id)
        for cost_item_id in affected:
            await self.recompute_actual_amount(cost_item_id)

    async def _reverse(self, original: Transaction, *, actor: uuid.UUID | None) -> Transaction:
        if original.transaction_type == TransactionType.REVERSAL:
            raise DomainValidationError("A Reversal transaction cannot itself be reversed.")
        if original.status != TransactionStatus.COMPLETED:
            raise InvalidStateError("Only Completed Transactions can be reversed.")
        if await self._repo.count_reversals_of(original.id) > 0:
            raise ConflictError("This Transaction has already been reversed.")

        await self._require_operational_event(original.event_id)

        affected_ids = list(
            await self._allocations.distinct_cost_item_ids_for_transaction(original.id)
        )

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

        if original.transaction_type == TransactionType.CLIENT_RECEIPT:
            if original.client_invoice_id is not None:
                await self._invoices.recalculate_after_receipt_change(
                    original.client_invoice_id, actor=actor
                )
        else:
            for cost_item_id in affected_ids:
                await self.recompute_actual_amount(cost_item_id)
            if original.cost_item_id is not None and original.cost_item_id not in affected_ids:
                await self.recompute_actual_amount(original.cost_item_id)

        await self._session.commit()
        await self._session.refresh(original)
        return original

    async def _assert_client_receipt_capacity(
        self,
        *,
        event_id: uuid.UUID,
        client_invoice_id: uuid.UUID | None,
        amount: Decimal,
    ) -> None:
        if client_invoice_id is None:
            raise DomainValidationError("Client Receipts require a Client Invoice.")
        invoice = await self._invoices.get(client_invoice_id)
        if invoice.status == ClientInvoiceStatus.CANCELLED:
            raise ConflictError("Cancelled invoices cannot receive payments.")
        if invoice.status == ClientInvoiceStatus.DRAFT:
            raise InvalidStateError("Client Receipts require an Issued (or later) Client Invoice.")
        if invoice.event_id != event_id:
            raise DomainValidationError(
                "Client Receipt event_id must match the Client Invoice event_id."
            )

        outstanding = await self._invoices.compute_outstanding(invoice.id)
        if amount > outstanding:
            raise ConflictError(
                "Client Receipt would exceed invoice Outstanding (overpayment is forbidden)."
            )

    async def _assert_allocations_mutable(self, transaction: Transaction) -> None:
        if transaction.status == TransactionStatus.REVERSED:
            raise InvalidStateError("Cannot modify allocations on a Reversed Transaction.")
        if transaction.status == TransactionStatus.FAILED:
            raise InvalidStateError("Cannot modify allocations on a Failed Transaction.")
        event = await self._events.get_by_id(transaction.event_id)
        if event is None:
            raise NotFoundError("Event not found.")
        if event.status == EventStatus.CLOSED:
            raise InvalidStateError(
                "Cost Allocations are immutable after Financial Close (Event Closed)."
            )
        if transaction.status not in {
            TransactionStatus.PENDING,
            TransactionStatus.COMPLETED,
        }:
            raise InvalidStateError("Allocations can only be replaced while Pending or Completed.")

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
        cost_item_id: uuid.UUID | None,
        allocation_lines: list[CostAllocationLine] | None = None,
    ) -> None:
        if txn_type == TransactionType.VENDOR_PAYMENT:
            if work_order_id is None:
                raise DomainValidationError("Vendor Payments require a Vendor Work Order.")
            work_order = await self._work_orders.get_by_id(work_order_id)
            if work_order is None:
                raise NotFoundError("Vendor Work Order not found.")
            wo_cost_item = work_order.cost_item_id
            if cost_item_id is not None and cost_item_id != wo_cost_item:
                raise DomainValidationError(
                    "transaction.cost_item_id must equal work_order.cost_item_id."
                )
            if cost_item_id is None:
                if allocation_lines:
                    ids = {line.cost_item_id for line in allocation_lines}
                    if wo_cost_item not in ids:
                        raise DomainValidationError(
                            "Vendor Payment allocations must include the Work Order Cost Item."
                        )
                else:
                    raise DomainValidationError(
                        "Vendor Payments require cost_item_id or allocations including "
                        "the Work Order Cost Item."
                    )
        elif txn_type == TransactionType.INTERNAL_EXPENSE:
            if work_order_id is not None:
                raise DomainValidationError(
                    "Internal Expenses must not reference a Vendor Work Order."
                )
