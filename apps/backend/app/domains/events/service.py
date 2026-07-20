"""Event business logic: lifecycle, archive policy, client association.

Status is a state machine — never applied as a plain field update. See
``docs/state_machine.md`` and ``docs/business_rules.md``.

Financial Close is Settlement → Closed validation on this aggregate (Phase 10 /
ADR 0012 / ADR 0013) — not a separate domain.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.service import ClientInvoiceService
from app.domains.clients.repository import ClientRepository
from app.domains.events.models import Event, EventStatus
from app.domains.events.repository import EventRepository
from app.domains.events.schemas import (
    EventCreate,
    EventUpdate,
    FinancialReadiness,
    FinancialReadinessChecks,
)
from app.domains.events.validators import normalize_event_fields
from app.domains.finance.financial_summary import EventFinancialSummary, FinancialSummaryService
from app.domains.transactions.models import TransactionType
from app.domains.transactions.service import TransactionService
from app.shared.errors import DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams

# Single source of truth for Event transitions (docs/state_machine.md).
ALLOWED_TRANSITIONS: dict[EventStatus, set[EventStatus]] = {
    EventStatus.DRAFT: {EventStatus.PLANNING, EventStatus.CANCELLED},
    EventStatus.PLANNING: {EventStatus.COMMERCIALS, EventStatus.CANCELLED},
    EventStatus.COMMERCIALS: {EventStatus.PROCUREMENT, EventStatus.CANCELLED},
    EventStatus.PROCUREMENT: {EventStatus.EXECUTION, EventStatus.CANCELLED},
    EventStatus.EXECUTION: {EventStatus.SETTLEMENT},
    EventStatus.SETTLEMENT: {EventStatus.CLOSED},
    EventStatus.CLOSED: set(),
    EventStatus.CANCELLED: set(),
}

_PENDING_TYPE_LABELS: dict[TransactionType, str] = {
    TransactionType.VENDOR_PAYMENT: "Vendor Payment",
    TransactionType.INTERNAL_EXPENSE: "Internal Expense",
    TransactionType.CLIENT_RECEIPT: "Client Receipt",
}


def _format_inr(amount: Decimal) -> str:
    return f"₹{format(amount.quantize(Decimal('0.01')), 'f')}"


class EventService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = EventRepository(session)
        self._clients = ClientRepository(session)
        self._invoices = ClientInvoiceService(session)
        self._summary = FinancialSummaryService(session)
        self._transactions = TransactionService(session)

    async def get(self, event_id: uuid.UUID) -> Event:
        return await self._repo.get_required(event_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        status: EventStatus | None = None,
        client_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[Event], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            status=status,
            client_id=client_id,
        )

    async def create(self, payload: EventCreate, *, actor: uuid.UUID | None = None) -> Event:
        data = normalize_event_fields(payload.model_dump())
        await self._require_non_archived_client(data["client_id"])
        self._validate_datetimes(data.get("start_datetime"), data.get("end_datetime"))

        event = Event(
            **data,
            status=EventStatus.DRAFT,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(event)
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def update(
        self, event_id: uuid.UUID, payload: EventUpdate, *, actor: uuid.UUID | None = None
    ) -> Event:
        """Apply field updates only. Never changes ``status``."""
        event = await self.get(event_id)
        self._assert_mutable(event)

        changes = normalize_event_fields(payload.model_dump(exclude_unset=True, exclude={"status"}))
        if not changes:
            return event

        if "client_id" in changes:
            await self._require_non_archived_client(changes["client_id"])

        start = changes.get("start_datetime", event.start_datetime)
        end = changes.get("end_datetime", event.end_datetime)
        self._validate_datetimes(start, end)

        for field, value in changes.items():
            setattr(event, field, value)
        event.updated_by = actor
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def transition_status(
        self,
        event_id: uuid.UUID,
        new_status: EventStatus,
        *,
        actor: uuid.UUID | None = None,
    ) -> Event:
        """Sole path for status changes. Validates ``ALLOWED_TRANSITIONS``."""
        event = await self.get(event_id)
        current = event.status

        if new_status == current:
            return event

        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise InvalidStateError(self._transition_error_message(current, new_status))

        if current == EventStatus.SETTLEMENT and new_status == EventStatus.CLOSED:
            await self._validate_financial_close(event_id)

        event.status = new_status
        event.updated_by = actor
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def financial_readiness(self, event_id: uuid.UUID) -> FinancialReadiness:
        """Informational Settlement → Closed readiness. Performs no mutations."""
        await self.get(event_id)
        return await self._assess_financial_close(event_id)

    async def financial_readiness_many(
        self,
        event_ids: Sequence[uuid.UUID],
        *,
        summaries: dict[uuid.UUID, EventFinancialSummary] | None = None,
    ) -> dict[uuid.UUID, FinancialReadiness]:
        """Same readiness rules as ``financial_readiness``, batched for dashboards.

        When ``summaries`` is provided (same formulas as ``FinancialSummaryService``),
        they are reused to avoid a second batch query.
        """
        ids = list(dict.fromkeys(event_ids))
        if not ids:
            return {}
        resolved = summaries if summaries is not None else await self._summary.for_events(ids)
        pending_by_event = await self._transactions.count_pending_financial_by_event(ids)
        return {
            event_id: self._readiness_from_facts(
                outstanding=resolved[event_id].outstanding,
                unattributed_spend=resolved[event_id].unattributed_spend,
                pending_by_type=pending_by_event.get(event_id, {}),
            )
            for event_id in ids
        }

    async def archive(self, event_id: uuid.UUID, *, actor: uuid.UUID | None = None) -> None:
        """Soft delete. Only Draft events may be archived (business_rules.md)."""
        event = await self.get(event_id)
        if event.status != EventStatus.DRAFT:
            raise InvalidStateError("Only Draft events may be archived.")
        if event.archived_at is None:
            event.archived_at = datetime.now(UTC)
            event.updated_by = actor
            await self._session.commit()

    async def _validate_financial_close(self, event_id: uuid.UUID) -> None:
        """Raise if Settlement → Closed financial gates fail (all reasons collected)."""
        readiness = await self._assess_financial_close(event_id)
        if readiness.ready:
            return
        raise InvalidStateError(
            "Cannot close Event until financial readiness checks pass.",
            details=readiness.blocking_reasons,
        )

    async def _assess_financial_close(self, event_id: uuid.UUID) -> FinancialReadiness:
        outstanding = await self._invoices.sum_event_outstanding(event_id)
        summary = await self._summary.for_event(event_id)
        pending_by_type = await self._transactions.count_pending_financial_by_type(event_id)
        return self._readiness_from_facts(
            outstanding=outstanding,
            unattributed_spend=summary.unattributed_spend,
            pending_by_type=pending_by_type,
        )

    @staticmethod
    def _readiness_from_facts(
        *,
        outstanding: Decimal,
        unattributed_spend: Decimal,
        pending_by_type: dict[TransactionType, int],
    ) -> FinancialReadiness:
        outstanding_ok = outstanding == 0
        unattributed_ok = unattributed_spend == 0
        pending_total = sum(pending_by_type.values())
        pending_ok = pending_total == 0

        reasons: list[str] = []
        if not outstanding_ok:
            reasons.append(f"Outstanding invoices: {_format_inr(outstanding)}")
        if not unattributed_ok:
            reasons.append(f"Unattributed spend: {_format_inr(unattributed_spend)}")
        if not pending_ok:
            for txn_type, count in pending_by_type.items():
                if count <= 0:
                    continue
                label = _PENDING_TYPE_LABELS[txn_type]
                plural = "s" if count != 1 else ""
                reasons.append(f"{count} Pending {label}{plural}")

        return FinancialReadiness(
            ready=outstanding_ok and unattributed_ok and pending_ok,
            checks=FinancialReadinessChecks(
                outstanding=outstanding_ok,
                unattributed_spend=unattributed_ok,
                pending_transactions=pending_ok,
            ),
            blocking_reasons=reasons,
        )

    def _assert_mutable(self, event: Event) -> None:
        if event.status == EventStatus.CLOSED:
            raise InvalidStateError("Closed events cannot be modified.")
        if event.status == EventStatus.CANCELLED:
            raise InvalidStateError("Cancelled events cannot be modified.")

    async def _require_non_archived_client(self, client_id: uuid.UUID) -> None:
        client = await self._clients.get_by_id(client_id)
        if client is None:
            raise NotFoundError("Client not found.")

    @staticmethod
    def _validate_datetimes(start: datetime | None, end: datetime | None) -> None:
        if start is not None and end is not None and end < start:
            raise DomainValidationError(
                "end_datetime must be greater than or equal to start_datetime."
            )

    @staticmethod
    def _transition_error_message(current: EventStatus, new_status: EventStatus) -> str:
        if current == EventStatus.CLOSED:
            return "Closed events cannot be reopened."
        if current == EventStatus.CANCELLED:
            return "Cancelled events cannot change status."
        return f"Cannot transition Event from {current.value} to {new_status.value}."
