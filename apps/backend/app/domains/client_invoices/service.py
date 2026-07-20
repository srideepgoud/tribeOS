"""Client Invoice business logic: commercial lifecycle and Outstanding (ADR 0013).

Partially Paid / Paid are never user transitions — they are derived from
Outstanding after Client Receipt Completes or Reverses.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.models import ClientInvoice, ClientInvoiceStatus
from app.domains.client_invoices.numbering import generate_invoice_number
from app.domains.client_invoices.repository import ClientInvoiceRepository
from app.domains.client_invoices.schemas import ClientInvoiceCreate, ClientInvoiceUpdate
from app.domains.client_invoices.validators import normalize_client_invoice_fields
from app.domains.clients.repository import ClientRepository
from app.domains.events.models import EventStatus
from app.domains.events.repository import EventRepository
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams

_COMMERCIAL_FIELDS = frozenset(
    {
        "event_id",
        "client_id",
        "invoice_date",
        "due_date",
        "amount",
        "gst_amount",
        "total_amount",
    }
)

_NOTES_ONLY_STATUSES = frozenset(
    {
        ClientInvoiceStatus.ISSUED,
        ClientInvoiceStatus.PARTIALLY_PAID,
    }
)

_LOCKED_STATUSES = frozenset(
    {
        ClientInvoiceStatus.PAID,
        ClientInvoiceStatus.CANCELLED,
    }
)


class ClientInvoiceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = ClientInvoiceRepository(session)
        self._events = EventRepository(session)
        self._clients = ClientRepository(session)

    async def get(self, invoice_id: uuid.UUID) -> ClientInvoice:
        return await self._repo.get_required(invoice_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        event_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        status: ClientInvoiceStatus | None = None,
    ) -> tuple[Sequence[ClientInvoice], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            event_id=event_id,
            client_id=client_id,
            status=status,
        )

    async def create(
        self, payload: ClientInvoiceCreate, *, actor: uuid.UUID | None = None
    ) -> ClientInvoice:
        data = normalize_client_invoice_fields(payload.model_dump())
        event = await self._require_financially_mutable_event(data["event_id"])
        await self._require_client(data["client_id"])
        if data["client_id"] != event.client_id:
            raise DomainValidationError(
                "Invoice client_id must match the Event's client_id."
            )

        invoice = ClientInvoice(
            event_id=data["event_id"],
            client_id=data["client_id"],
            invoice_number=generate_invoice_number(),
            invoice_date=data["invoice_date"],
            due_date=data.get("due_date"),
            amount=Decimal(data["amount"]),
            gst_amount=Decimal(data["gst_amount"]),
            total_amount=Decimal(data["total_amount"]),
            notes=data.get("notes"),
            status=ClientInvoiceStatus.DRAFT,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(invoice)
        await self._session.commit()
        await self._session.refresh(invoice)
        return invoice

    async def update_draft(
        self,
        invoice_id: uuid.UUID,
        payload: ClientInvoiceUpdate,
        *,
        actor: uuid.UUID | None = None,
    ) -> ClientInvoice:
        """Field updates only. Never changes ``status`` or ``invoice_number``."""
        invoice = await self.get(invoice_id)
        await self._require_financially_mutable_event(invoice.event_id)
        if invoice.status in _LOCKED_STATUSES:
            raise InvalidStateError(
                f"{invoice.status.value} Client Invoices cannot be modified."
            )

        changes = normalize_client_invoice_fields(
            payload.model_dump(exclude_unset=True, exclude={"status"})
        )
        if not changes:
            return invoice

        commercial_requested = _COMMERCIAL_FIELDS & changes.keys()
        if commercial_requested and invoice.status != ClientInvoiceStatus.DRAFT:
            raise InvalidStateError(
                "Commercial fields are immutable once the Client Invoice is Issued."
            )
        if invoice.status in _NOTES_ONLY_STATUSES:
            disallowed = set(changes.keys()) - {"notes"}
            if disallowed:
                raise InvalidStateError(
                    "Only notes may be updated after the Client Invoice is Issued."
                )

        if "event_id" in changes or "client_id" in changes:
            event_id = changes.get("event_id", invoice.event_id)
            client_id = changes.get("client_id", invoice.client_id)
            event = await self._require_financially_mutable_event(event_id)
            await self._require_client(client_id)
            if client_id != event.client_id:
                raise DomainValidationError(
                    "Invoice client_id must match the Event's client_id."
                )

        for field, value in changes.items():
            setattr(invoice, field, value)
        invoice.updated_by = actor
        await self._repo.update(invoice)
        await self._session.commit()
        await self._session.refresh(invoice)
        return invoice

    async def issue_invoice(
        self, invoice_id: uuid.UUID, *, actor: uuid.UUID | None = None
    ) -> ClientInvoice:
        invoice = await self.get(invoice_id)
        await self._require_financially_mutable_event(invoice.event_id)
        if invoice.status != ClientInvoiceStatus.DRAFT:
            raise InvalidStateError(
                f"Cannot issue Client Invoice from {invoice.status.value}."
            )
        if invoice.total_amount < 0:
            raise DomainValidationError("Invoice totals cannot be negative.")

        invoice.status = ClientInvoiceStatus.ISSUED
        invoice.updated_by = actor
        await self._repo.update(invoice)
        await self._session.commit()
        await self._session.refresh(invoice)
        return invoice

    async def cancel_invoice(
        self, invoice_id: uuid.UUID, *, actor: uuid.UUID | None = None
    ) -> ClientInvoice:
        invoice = await self.get(invoice_id)
        await self._require_financially_mutable_event(invoice.event_id)
        current = invoice.status

        if current == ClientInvoiceStatus.CANCELLED:
            return invoice
        if current in {
            ClientInvoiceStatus.PARTIALLY_PAID,
            ClientInvoiceStatus.PAID,
        }:
            raise InvalidStateError(
                f"Cannot cancel a {current.value} Client Invoice."
            )
        if current == ClientInvoiceStatus.ISSUED:
            outstanding = await self._compute_outstanding(invoice)
            if outstanding != invoice.total_amount:
                raise InvalidStateError(
                    "Cannot cancel an Issued Client Invoice that has Completed receipts."
                )
        elif current != ClientInvoiceStatus.DRAFT:
            raise InvalidStateError(
                f"Cannot cancel Client Invoice from {current.value}."
            )

        invoice.status = ClientInvoiceStatus.CANCELLED
        invoice.updated_by = actor
        await self._repo.update(invoice)
        await self._session.commit()
        await self._session.refresh(invoice)
        return invoice

    async def compute_outstanding(self, invoice_id: uuid.UUID) -> Decimal:
        invoice = await self.get(invoice_id)
        return await self._compute_outstanding(invoice)

    async def sum_event_outstanding(self, event_id: uuid.UUID) -> Decimal:
        """Sum Outstanding for non-Cancelled invoices on an Event (Financial Close)."""
        await self._require_event(event_id)
        by_event = await self.sum_outstanding_by_event([event_id])
        return by_event.get(event_id, Decimal("0"))

    async def sum_outstanding_by_event(
        self, event_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, Decimal]:
        """Same Outstanding formula as ``sum_event_outstanding``, batched by Event."""
        if not event_ids:
            return {}
        invoices = await self._repo.list_by_events(event_ids)
        totals: dict[uuid.UUID, Decimal] = {event_id: Decimal("0") for event_id in event_ids}
        for invoice in invoices:
            if invoice.status == ClientInvoiceStatus.CANCELLED:
                continue
            totals[invoice.event_id] = totals.get(invoice.event_id, Decimal("0")) + (
                await self._compute_outstanding(invoice)
            )
        return totals

    async def recalculate_after_receipt_change(
        self, invoice_id: uuid.UUID, *, actor: uuid.UUID | None = None
    ) -> ClientInvoice:
        """Public hook for TransactionService after Client Receipt Complete/Reverse.

        Flushes status changes; does not commit (caller owns the unit of work).
        """
        invoice = await self.get(invoice_id)
        outstanding = await self._compute_outstanding(invoice)
        new_status = self.derive_status(invoice, outstanding)
        if new_status != invoice.status:
            invoice.status = new_status
            invoice.updated_by = actor
            await self._repo.update(invoice)
        else:
            await self._session.flush()
        return invoice

    @staticmethod
    def derive_status(
        invoice: ClientInvoice, outstanding: Decimal
    ) -> ClientInvoiceStatus:
        """Pure derived-status rules (ADR 0013). Draft/Cancelled never auto-change."""
        if invoice.status == ClientInvoiceStatus.DRAFT:
            return ClientInvoiceStatus.DRAFT
        if invoice.status == ClientInvoiceStatus.CANCELLED:
            return ClientInvoiceStatus.CANCELLED

        total = invoice.total_amount
        if outstanding == total:
            return ClientInvoiceStatus.ISSUED
        if outstanding == Decimal("0"):
            return ClientInvoiceStatus.PAID
        if Decimal("0") < outstanding < total:
            return ClientInvoiceStatus.PARTIALLY_PAID

        # Defensive: should be unreachable when overpayment is rejected at Complete.
        raise ConflictError("Outstanding is outside the valid range for derived status.")

    async def _compute_outstanding(self, invoice: ClientInvoice) -> Decimal:
        received = await self._repo.sum_completed_receipts(invoice.id)
        outstanding = invoice.total_amount - received
        if outstanding < 0:
            raise ConflictError("Outstanding cannot be negative.")
        return outstanding

    async def _require_event(self, event_id: uuid.UUID):
        event = await self._events.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Event not found.")
        return event

    async def _require_financially_mutable_event(self, event_id: uuid.UUID):
        event = await self._require_event(event_id)
        if event.status == EventStatus.CLOSED:
            raise InvalidStateError(
                "Client Invoices cannot be modified after Financial Close (Event Closed)."
            )
        if event.status == EventStatus.CANCELLED:
            raise InvalidStateError(
                "Client Invoices cannot be modified while the Event is Cancelled."
            )
        return event

    async def _require_client(self, client_id: uuid.UUID) -> None:
        client = await self._clients.get_by_id(client_id)
        if client is None:
            raise NotFoundError("Client not found.")
