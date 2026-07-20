"""Operations Dashboard aggregation.

Composes EventService, FinancialSummaryService, and related repositories.
Does not invent financial rules — Event Profit / Gross Profit is
``Billed Revenue − Attributed Cost`` from ``docs/business_rules.md``.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.dashboard.schemas import (
    DashboardAttention,
    DashboardEventRow,
    DashboardFinance,
    DashboardOverview,
    OperationsDashboard,
)
from app.domains.events.models import EventStatus
from app.domains.events.repository import EventRepository, EventWithClientName
from app.domains.events.schemas import FinancialReadiness
from app.domains.events.service import EventService
from app.domains.finance.financial_summary import EventFinancialSummary, FinancialSummaryService

_ZERO = Decimal("0")

# Operational workload before Settlement (overview "Active Events").
_ACTIVE_STATUSES = frozenset(
    {
        EventStatus.DRAFT,
        EventStatus.PLANNING,
        EventStatus.COMMERCIALS,
        EventStatus.PROCUREMENT,
        EventStatus.EXECUTION,
    }
)

# Event grid: Active + Settlement (exclude Closed / Cancelled).
_GRID_STATUSES = frozenset(_ACTIVE_STATUSES | {EventStatus.SETTLEMENT})

# Portfolio finance totals: operational grid + Closed history.
_FINANCE_STATUSES = frozenset(_GRID_STATUSES | {EventStatus.CLOSED})


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self._events_repo = EventRepository(session)
        self._events = EventService(session)
        self._summary = FinancialSummaryService(session)

    async def get_operations_dashboard(self) -> OperationsDashboard:
        status_counts = await self._events_repo.count_non_archived_by_status()
        active_events = sum(status_counts.get(status, 0) for status in _ACTIVE_STATUSES)
        settlement_events = status_counts.get(EventStatus.SETTLEMENT, 0)
        closed_events = status_counts.get(EventStatus.CLOSED, 0)

        grid_rows = await self._events_repo.list_non_archived_by_statuses(list(_GRID_STATUSES))
        finance_rows = await self._events_repo.list_non_archived_by_statuses(
            list(_FINANCE_STATUSES)
        )

        finance_ids = [row.event.id for row in finance_rows]
        grid_ids = [row.event.id for row in grid_rows]

        summaries = await self._summary.for_events(finance_ids)
        readiness = await self._events.financial_readiness_many(grid_ids, summaries=summaries)

        ready_to_close = sum(
            1
            for row in grid_rows
            if row.event.status == EventStatus.SETTLEMENT and readiness[row.event.id].ready
        )

        return OperationsDashboard(
            overview=DashboardOverview(
                active_events=active_events,
                settlement_events=settlement_events,
                closed_events=closed_events,
                ready_to_close=ready_to_close,
            ),
            finance=self._aggregate_finance(summaries),
            attention=self._attention_counts(grid_rows, summaries, readiness),
            events=[
                self._event_row(
                    event_id=row.event.id,
                    name=row.event.name,
                    status=row.event.status,
                    client_name=row.client_name,
                    summary=summaries[row.event.id],
                    financial_ready=readiness[row.event.id].ready,
                )
                for row in grid_rows
            ],
        )

    @staticmethod
    def _aggregate_finance(
        summaries: dict[uuid.UUID, EventFinancialSummary],
    ) -> DashboardFinance:
        billed = sum((s.billed_revenue for s in summaries.values()), _ZERO)
        received = sum((s.cash_received for s in summaries.values()), _ZERO)
        outstanding = sum((s.outstanding for s in summaries.values()), _ZERO)
        spent = sum((s.cash_spent for s in summaries.values()), _ZERO)
        attributed = sum((s.attributed_cost for s in summaries.values()), _ZERO)
        # Event Profit (business_rules.md) — presented as Gross Profit on the dashboard.
        return DashboardFinance(
            billed_revenue=billed,
            cash_received=received,
            outstanding=outstanding,
            cash_spent=spent,
            attributed_cost=attributed,
            gross_profit=billed - attributed,
        )

    @staticmethod
    def _attention_counts(
        grid_rows: Sequence[EventWithClientName],
        summaries: dict[uuid.UUID, EventFinancialSummary],
        readiness: dict[uuid.UUID, FinancialReadiness],
    ) -> DashboardAttention:
        outstanding_events = 0
        pending_transactions = 0
        unattributed_events = 0
        ready_to_close_events = 0

        for row in grid_rows:
            summary = summaries[row.event.id]
            ready = readiness[row.event.id]
            if summary.outstanding > 0:
                outstanding_events += 1
            if not ready.checks.pending_transactions:
                pending_transactions += 1
            if summary.unattributed_spend > 0:
                unattributed_events += 1
            if row.event.status == EventStatus.SETTLEMENT and ready.ready:
                ready_to_close_events += 1

        return DashboardAttention(
            outstanding_events=outstanding_events,
            pending_transactions=pending_transactions,
            unattributed_events=unattributed_events,
            ready_to_close_events=ready_to_close_events,
        )

    @staticmethod
    def _event_row(
        *,
        event_id: uuid.UUID,
        name: str,
        status: EventStatus,
        client_name: str,
        summary: EventFinancialSummary,
        financial_ready: bool,
    ) -> DashboardEventRow:
        return DashboardEventRow(
            id=event_id,
            name=name,
            status=status,
            client_name=client_name,
            billed_revenue=summary.billed_revenue,
            cash_received=summary.cash_received,
            outstanding=summary.outstanding,
            attributed_cost=summary.attributed_cost,
            gross_profit=summary.billed_revenue - summary.attributed_cost,
            financial_ready=financial_ready,
        )
