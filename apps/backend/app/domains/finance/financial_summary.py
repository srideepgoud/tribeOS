"""Event-level financial summary (ADR 0012 / 0013).

Composes invoice, transaction, and allocation repositories — not embedded in
aggregate services. Cash Spent excludes Client Receipts (Cash Received).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.models import ClientInvoice, ClientInvoiceStatus
from app.domains.client_invoices.service import ClientInvoiceService
from app.domains.cost_allocations.repository import CostAllocationRepository
from app.domains.events.repository import EventRepository
from app.domains.transactions.models import Transaction, TransactionStatus, TransactionType

_BILLED_STATUSES = frozenset(
    {
        ClientInvoiceStatus.ISSUED,
        ClientInvoiceStatus.PARTIALLY_PAID,
        ClientInvoiceStatus.PAID,
    }
)

_CASH_SPENT_TYPES = frozenset(
    {
        TransactionType.VENDOR_PAYMENT,
        TransactionType.INTERNAL_EXPENSE,
    }
)

_ZERO = Decimal("0")


class EventFinancialSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    cash_spent: Decimal
    attributed_cost: Decimal
    unattributed_spend: Decimal
    billed_revenue: Decimal
    cash_received: Decimal
    outstanding: Decimal

    @field_serializer(
        "cash_spent",
        "attributed_cost",
        "unattributed_spend",
        "billed_revenue",
        "cash_received",
        "outstanding",
    )
    def serialize_money(self, value: Decimal) -> str:
        return format(value.quantize(Decimal("0.01")), "f")


class FinancialSummaryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._events = EventRepository(session)
        self._allocations = CostAllocationRepository(session)
        self._invoice_service = ClientInvoiceService(session)

    async def for_event(self, event_id: uuid.UUID) -> EventFinancialSummary:
        await self._events.get_required(event_id)
        summaries = await self.for_events([event_id])
        return summaries[event_id]

    async def for_events(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, EventFinancialSummary]:
        """Same formulas as ``for_event``, batched to avoid N+1 queries."""
        ids = list(dict.fromkeys(event_ids))
        if not ids:
            return {}

        cash_spent = await self._sum_cash_spent_by_event(ids)
        attributed = await self._allocations.sum_completed_allocations_by_event(ids)
        billed = await self._sum_billed_revenue_by_event(ids)
        received = await self._sum_cash_received_by_event(ids)
        outstanding = await self._invoice_service.sum_outstanding_by_event(ids)

        result: dict[uuid.UUID, EventFinancialSummary] = {}
        for event_id in ids:
            spent = cash_spent.get(event_id, _ZERO)
            attributed_cost = attributed.get(event_id, _ZERO)
            result[event_id] = EventFinancialSummary(
                event_id=event_id,
                cash_spent=spent,
                attributed_cost=attributed_cost,
                unattributed_spend=max(spent - attributed_cost, _ZERO),
                billed_revenue=billed.get(event_id, _ZERO),
                cash_received=received.get(event_id, _ZERO),
                outstanding=outstanding.get(event_id, _ZERO),
            )
        return result

    async def _sum_cash_spent(self, event_id: uuid.UUID) -> Decimal:
        by_event = await self._sum_cash_spent_by_event([event_id])
        return by_event.get(event_id, _ZERO)

    async def _sum_cash_received(self, event_id: uuid.UUID) -> Decimal:
        by_event = await self._sum_cash_received_by_event([event_id])
        return by_event.get(event_id, _ZERO)

    async def _sum_billed_revenue(self, event_id: uuid.UUID) -> Decimal:
        by_event = await self._sum_billed_revenue_by_event([event_id])
        return by_event.get(event_id, _ZERO)

    async def _sum_cash_spent_by_event(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, Decimal]:
        stmt = (
            select(Transaction.event_id, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.event_id.in_(event_ids),
                Transaction.status == TransactionStatus.COMPLETED,
                Transaction.transaction_type.in_(_CASH_SPENT_TYPES),
            )
            .group_by(Transaction.event_id)
        )
        rows = (await self._session.execute(stmt)).all()
        return {event_id: Decimal(str(value)) for event_id, value in rows}

    async def _sum_cash_received_by_event(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, Decimal]:
        stmt = (
            select(Transaction.event_id, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.event_id.in_(event_ids),
                Transaction.status == TransactionStatus.COMPLETED,
                Transaction.transaction_type == TransactionType.CLIENT_RECEIPT,
            )
            .group_by(Transaction.event_id)
        )
        rows = (await self._session.execute(stmt)).all()
        return {event_id: Decimal(str(value)) for event_id, value in rows}

    async def _sum_billed_revenue_by_event(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, Decimal]:
        stmt = (
            select(ClientInvoice.event_id, func.coalesce(func.sum(ClientInvoice.total_amount), 0))
            .where(
                ClientInvoice.event_id.in_(event_ids),
                ClientInvoice.status.in_(_BILLED_STATUSES),
            )
            .group_by(ClientInvoice.event_id)
        )
        rows = (await self._session.execute(stmt)).all()
        return {event_id: Decimal(str(value)) for event_id, value in rows}
