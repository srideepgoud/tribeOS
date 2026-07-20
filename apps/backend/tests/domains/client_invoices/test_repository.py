"""ClientInvoiceRepository persistence tests (no business-rule assertions)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.models import ClientInvoice, ClientInvoiceStatus
from app.domains.client_invoices.repository import ClientInvoiceRepository
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
from app.shared.errors import NotFoundError


async def _seed_event(session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    return client.id, event.id


def _invoice(
    *,
    event_id: uuid.UUID,
    client_id: uuid.UUID,
    number: str,
    status: ClientInvoiceStatus = ClientInvoiceStatus.DRAFT,
    total: str = "100000.00",
) -> ClientInvoice:
    return ClientInvoice(
        event_id=event_id,
        client_id=client_id,
        invoice_number=number,
        invoice_date=date(2026, 7, 1),
        amount=Decimal(total),
        gst_amount=Decimal("0.00"),
        total_amount=Decimal(total),
        status=status,
    )


async def test_add_get_exists_and_update(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed_event(db_session)
    repo = ClientInvoiceRepository(db_session)
    invoice = _invoice(event_id=event_id, client_id=client_id, number="INV-REPO00000001")
    await repo.add(invoice)
    await db_session.commit()

    loaded = await repo.get_by_id(invoice.id)
    assert loaded is not None
    assert loaded.invoice_number == "INV-REPO00000001"
    assert await repo.exists(invoice.id) is True
    assert await repo.exists(uuid.uuid4()) is False

    invoice.notes = "Updated note"
    await repo.update(invoice)
    await db_session.commit()
    assert (await repo.get_required(invoice.id)).notes == "Updated note"


async def test_get_required_missing(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await ClientInvoiceRepository(db_session).get_required(uuid.uuid4())


async def test_list_paginated_filters_and_list_by(db_session: AsyncSession) -> None:
    client_a = await ClientService(db_session).create(ClientCreate(company_name="Alpha"))
    client_b = await ClientService(db_session).create(ClientCreate(company_name="Beta"))
    event_a = await EventService(db_session).create(
        EventCreate(client_id=client_a.id, name="Event A")
    )
    event_b = await EventService(db_session).create(
        EventCreate(client_id=client_b.id, name="Event B")
    )
    repo = ClientInvoiceRepository(db_session)

    await repo.add(
        _invoice(
            event_id=event_a.id,
            client_id=client_a.id,
            number="INV-FILTER000001",
            status=ClientInvoiceStatus.ISSUED,
        )
    )
    await repo.add(
        _invoice(
            event_id=event_a.id,
            client_id=client_a.id,
            number="INV-FILTER000002",
            status=ClientInvoiceStatus.DRAFT,
        )
    )
    await repo.add(
        _invoice(
            event_id=event_b.id,
            client_id=client_b.id,
            number="INV-FILTER000003",
            status=ClientInvoiceStatus.ISSUED,
        )
    )
    await db_session.commit()

    rows, total = await repo.list_paginated(
        q=None,
        sort=None,
        offset=0,
        limit=50,
        event_id=event_a.id,
        status=ClientInvoiceStatus.ISSUED,
    )
    assert total == 1
    assert rows[0].invoice_number == "INV-FILTER000001"

    by_event = await repo.list_by_event(event_a.id)
    assert len(by_event) == 2
    by_client = await repo.list_by_client(client_b.id)
    assert len(by_client) == 1
    assert by_client[0].invoice_number == "INV-FILTER000003"

    searched, searched_total = await repo.list_paginated(
        q="FILTER000002",
        sort="invoice_number",
        offset=0,
        limit=10,
    )
    assert searched_total == 1
    assert searched[0].invoice_number == "INV-FILTER000002"


async def test_unique_invoice_number_constraint(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed_event(db_session)
    repo = ClientInvoiceRepository(db_session)
    await repo.add(_invoice(event_id=event_id, client_id=client_id, number="INV-DUP000000001"))
    await db_session.commit()

    assert await repo.count_by_invoice_number("INV-DUP000000001") == 1

    with pytest.raises(IntegrityError):
        await repo.add(_invoice(event_id=event_id, client_id=client_id, number="INV-DUP000000001"))
    await db_session.rollback()


async def test_sum_completed_receipts_excludes_non_completed(db_session: AsyncSession) -> None:
    client_id, event_id = await _seed_event(db_session)
    invoice_repo = ClientInvoiceRepository(db_session)
    txn_repo = TransactionRepository(db_session)

    invoice = _invoice(
        event_id=event_id,
        client_id=client_id,
        number="INV-SUM0000000001",
        status=ClientInvoiceStatus.ISSUED,
        total="100000.00",
    )
    await invoice_repo.add(invoice)
    await db_session.flush()

    await txn_repo.add(
        Transaction(
            event_id=event_id,
            client_invoice_id=invoice.id,
            transaction_type=TransactionType.CLIENT_RECEIPT,
            payment_method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("40000.00"),
            transaction_date=date(2026, 7, 2),
            status=TransactionStatus.COMPLETED,
        )
    )
    await txn_repo.add(
        Transaction(
            event_id=event_id,
            client_invoice_id=invoice.id,
            transaction_type=TransactionType.CLIENT_RECEIPT,
            payment_method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("10000.00"),
            transaction_date=date(2026, 7, 3),
            status=TransactionStatus.PENDING,
        )
    )
    await txn_repo.add(
        Transaction(
            event_id=event_id,
            client_invoice_id=invoice.id,
            transaction_type=TransactionType.CLIENT_RECEIPT,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("5000.00"),
            transaction_date=date(2026, 7, 4),
            status=TransactionStatus.FAILED,
        )
    )
    reversed_original = Transaction(
        event_id=event_id,
        client_invoice_id=invoice.id,
        transaction_type=TransactionType.CLIENT_RECEIPT,
        payment_method=PaymentMethod.UPI,
        amount=Decimal("15000.00"),
        transaction_date=date(2026, 7, 5),
        status=TransactionStatus.REVERSED,
    )
    await txn_repo.add(reversed_original)
    await db_session.flush()
    await txn_repo.add(
        Transaction(
            event_id=event_id,
            client_invoice_id=invoice.id,
            reverses_transaction_id=reversed_original.id,
            transaction_type=TransactionType.REVERSAL,
            payment_method=PaymentMethod.UPI,
            amount=Decimal("-15000.00"),
            transaction_date=date(2026, 7, 5),
            status=TransactionStatus.COMPLETED,
        )
    )
    await db_session.commit()

    assert await invoice_repo.sum_completed_receipts(invoice.id) == Decimal("40000.00")
    assert await invoice_repo.sum_completed_receipts(uuid.uuid4()) == Decimal("0")
