"""ClientInvoiceService tests — commercial invariants (ADR 0013)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.models import ClientInvoiceStatus
from app.domains.client_invoices.schemas import ClientInvoiceCreate, ClientInvoiceUpdate
from app.domains.client_invoices.service import ClientInvoiceService
from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.transactions.models import (
    PaymentMethod,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.domains.transactions.repository import TransactionRepository
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError
from app.shared.pagination import PageParams


async def _seed(session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    return client.id, event.id


def _create_payload(
    event_id: uuid.UUID,
    client_id: uuid.UUID,
    *,
    total: str = "100000.00",
) -> ClientInvoiceCreate:
    return ClientInvoiceCreate(
        event_id=event_id,
        client_id=client_id,
        invoice_date=date(2026, 7, 1),
        amount=Decimal(total),
        gst_amount=Decimal("0.00"),
        total_amount=Decimal(total),
        notes="Initial",
    )


async def _add_receipt(
    session: AsyncSession,
    *,
    event_id: uuid.UUID,
    invoice_id: uuid.UUID,
    amount: Decimal,
    status: TransactionStatus = TransactionStatus.COMPLETED,
) -> Transaction:
    txn = Transaction(
        event_id=event_id,
        client_invoice_id=invoice_id,
        transaction_type=TransactionType.CLIENT_RECEIPT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        amount=amount,
        transaction_date=date(2026, 7, 10),
        status=status,
    )
    await TransactionRepository(session).add(txn)
    await session.commit()
    return txn


async def test_create_draft_and_number_generation(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))

    assert invoice.status == ClientInvoiceStatus.DRAFT
    assert invoice.invoice_number.startswith("INV-")
    assert len(invoice.invoice_number) == 16
    assert await service.compute_outstanding(invoice.id) == Decimal("100000.00")


async def test_create_rejects_mismatched_client(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    other = await ClientService(db_session).create(ClientCreate(company_name="Other"))
    service = ClientInvoiceService(db_session)

    with pytest.raises(DomainValidationError):
        await service.create(_create_payload(event_id, other.id))


async def test_update_draft_and_issued_notes_only(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))

    invoice = await service.update_draft(
        invoice.id,
        ClientInvoiceUpdate(notes="Draft notes", total_amount=Decimal("120000.00")),
    )
    assert invoice.notes == "Draft notes"
    assert invoice.total_amount == Decimal("120000.00")

    invoice = await service.issue_invoice(invoice.id)
    assert invoice.status == ClientInvoiceStatus.ISSUED

    invoice = await service.update_draft(invoice.id, ClientInvoiceUpdate(notes="Issued notes"))
    assert invoice.notes == "Issued notes"

    with pytest.raises(InvalidStateError):
        await service.update_draft(
            invoice.id, ClientInvoiceUpdate(total_amount=Decimal("999.00"))
        )


async def test_issue_only_from_draft(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))
    await service.issue_invoice(invoice.id)

    with pytest.raises(InvalidStateError):
        await service.issue_invoice(invoice.id)


async def test_cancel_draft_and_issued_without_receipts(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)

    draft = await service.create(_create_payload(event_id, client_id, total="1000.00"))
    draft = await service.cancel_invoice(draft.id)
    assert draft.status == ClientInvoiceStatus.CANCELLED

    issued = await service.create(_create_payload(event_id, client_id, total="2000.00"))
    issued = await service.issue_invoice(issued.id)
    issued = await service.cancel_invoice(issued.id)
    assert issued.status == ClientInvoiceStatus.CANCELLED


async def test_cancel_issued_with_receipts_rejected(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))
    invoice = await service.issue_invoice(invoice.id)
    await _add_receipt(
        db_session, event_id=event_id, invoice_id=invoice.id, amount=Decimal("10000.00")
    )
    await service.recalculate_after_receipt_change(invoice.id)
    await db_session.commit()

    invoice = await service.get(invoice.id)
    assert invoice.status == ClientInvoiceStatus.PARTIALLY_PAID

    with pytest.raises(InvalidStateError):
        await service.cancel_invoice(invoice.id)


async def test_derived_status_and_outstanding(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))
    invoice = await service.issue_invoice(invoice.id)

    await _add_receipt(
        db_session, event_id=event_id, invoice_id=invoice.id, amount=Decimal("40000.00")
    )
    invoice = await service.recalculate_after_receipt_change(invoice.id)
    await db_session.commit()
    assert invoice.status == ClientInvoiceStatus.PARTIALLY_PAID
    assert await service.compute_outstanding(invoice.id) == Decimal("60000.00")

    await _add_receipt(
        db_session, event_id=event_id, invoice_id=invoice.id, amount=Decimal("60000.00")
    )
    invoice = await service.recalculate_after_receipt_change(invoice.id)
    await db_session.commit()
    assert invoice.status == ClientInvoiceStatus.PAID
    assert await service.compute_outstanding(invoice.id) == Decimal("0")


async def test_receipt_reversal_updates_status(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))
    invoice = await service.issue_invoice(invoice.id)

    receipt = await _add_receipt(
        db_session, event_id=event_id, invoice_id=invoice.id, amount=Decimal("100000.00")
    )
    invoice = await service.recalculate_after_receipt_change(invoice.id)
    await db_session.commit()
    assert invoice.status == ClientInvoiceStatus.PAID

    receipt.status = TransactionStatus.REVERSED
    await TransactionRepository(db_session).add(
        Transaction(
            event_id=event_id,
            client_invoice_id=invoice.id,
            reverses_transaction_id=receipt.id,
            transaction_type=TransactionType.REVERSAL,
            payment_method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("-100000.00"),
            transaction_date=date(2026, 7, 11),
            status=TransactionStatus.COMPLETED,
        )
    )
    await db_session.commit()

    invoice = await service.recalculate_after_receipt_change(invoice.id)
    await db_session.commit()
    assert invoice.status == ClientInvoiceStatus.ISSUED
    assert await service.compute_outstanding(invoice.id) == Decimal("100000.00")


async def test_outstanding_never_negative(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id, total="1000.00"))
    await service.issue_invoice(invoice.id)
    await _add_receipt(
        db_session, event_id=event_id, invoice_id=invoice.id, amount=Decimal("1500.00")
    )

    with pytest.raises(ConflictError):
        await service.recalculate_after_receipt_change(invoice.id)


async def test_paid_invoice_locked(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    invoice = await service.create(_create_payload(event_id, client_id))
    await service.issue_invoice(invoice.id)
    await _add_receipt(
        db_session, event_id=event_id, invoice_id=invoice.id, amount=Decimal("100000.00")
    )
    invoice = await service.recalculate_after_receipt_change(invoice.id)
    await db_session.commit()
    assert invoice.status == ClientInvoiceStatus.PAID

    with pytest.raises(InvalidStateError):
        await service.update_draft(invoice.id, ClientInvoiceUpdate(notes="Nope"))
    with pytest.raises(InvalidStateError):
        await service.cancel_invoice(invoice.id)


async def test_sum_event_outstanding_excludes_cancelled(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)

    a = await service.create(_create_payload(event_id, client_id, total="10000.00"))
    await service.issue_invoice(a.id)
    b = await service.create(_create_payload(event_id, client_id, total="5000.00"))
    await service.cancel_invoice(b.id)

    assert await service.sum_event_outstanding(event_id) == Decimal("10000.00")

    await _add_receipt(
        db_session, event_id=event_id, invoice_id=a.id, amount=Decimal("2500.00")
    )
    await service.recalculate_after_receipt_change(a.id)
    await db_session.commit()
    assert await service.sum_event_outstanding(event_id) == Decimal("7500.00")


async def test_list_invoices(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed(db_session)
    service = ClientInvoiceService(db_session)
    await service.create(_create_payload(event_id, client_id, total="1.00"))
    await service.create(_create_payload(event_id, client_id, total="2.00"))
    rows, total = await service.list(
        page=PageParams(page=1, page_size=10),
        q=None,
        sort=None,
        event_id=event_id,
    )
    assert total == 2
    assert len(rows) == 2


async def test_derive_status_matrix() -> None:
    from app.domains.client_invoices.models import ClientInvoice

    draft = ClientInvoice(
        event_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        invoice_number="INV-X",
        invoice_date=date(2026, 7, 1),
        amount=Decimal("100"),
        gst_amount=Decimal("0"),
        total_amount=Decimal("100"),
        status=ClientInvoiceStatus.DRAFT,
    )
    assert ClientInvoiceService.derive_status(draft, Decimal("100")) == ClientInvoiceStatus.DRAFT

    cancelled = ClientInvoice(
        event_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        invoice_number="INV-Y",
        invoice_date=date(2026, 7, 1),
        amount=Decimal("100"),
        gst_amount=Decimal("0"),
        total_amount=Decimal("100"),
        status=ClientInvoiceStatus.CANCELLED,
    )
    assert (
        ClientInvoiceService.derive_status(cancelled, Decimal("100"))
        == ClientInvoiceStatus.CANCELLED
    )

    issued = ClientInvoice(
        event_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        invoice_number="INV-Z",
        invoice_date=date(2026, 7, 1),
        amount=Decimal("100"),
        gst_amount=Decimal("0"),
        total_amount=Decimal("100"),
        status=ClientInvoiceStatus.ISSUED,
    )
    assert ClientInvoiceService.derive_status(issued, Decimal("100")) == ClientInvoiceStatus.ISSUED
    assert (
        ClientInvoiceService.derive_status(issued, Decimal("40"))
        == ClientInvoiceStatus.PARTIALLY_PAID
    )
    assert ClientInvoiceService.derive_status(issued, Decimal("0")) == ClientInvoiceStatus.PAID
