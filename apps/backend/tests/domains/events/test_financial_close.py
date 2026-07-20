"""Phase 10 — Financial Close (Settlement → Closed) integration tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.schemas import ClientInvoiceCreate
from app.domains.client_invoices.service import ClientInvoiceService
from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_allocations.schemas import CostAllocationLine, CostAllocationReplace
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.transactions.models import PaymentMethod, TransactionStatus, TransactionType
from app.domains.transactions.schemas import TransactionCreate
from app.domains.transactions.service import TransactionService
from app.domains.vendor_work_orders.schemas import VendorWorkOrderCreate
from app.domains.vendor_work_orders.service import VendorWorkOrderService
from app.domains.vendors.schemas import VendorCreate
from app.domains.vendors.service import VendorService
from app.shared.errors import InvalidStateError


async def _seed(session: AsyncSession) -> dict:
    client = await ClientService(session).create(ClientCreate(company_name="Close Co"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Close Fest"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Ops")
    )
    item = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Crew",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("100000.00"),
        )
    )
    return {"client": client, "event": event, "item": item}


async def _advance_to_settlement(service: EventService, event_id) -> None:
    for status in (
        EventStatus.PLANNING,
        EventStatus.COMMERCIALS,
        EventStatus.PROCUREMENT,
        EventStatus.EXECUTION,
        EventStatus.SETTLEMENT,
    ):
        await service.transition_status(event_id, status)


async def test_ready_event_closes_successfully(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    events = EventService(db_session)
    txns = TransactionService(db_session)

    txn = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["item"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("1000.00"),
            transaction_date=date(2026, 7, 1),
        )
    )
    await txns.transition_status(txn.id, TransactionStatus.COMPLETED)

    await _advance_to_settlement(events, seed["event"].id)
    readiness = await events.financial_readiness(seed["event"].id)
    assert readiness.ready is True
    assert readiness.checks.outstanding is True
    assert readiness.checks.unattributed_spend is True
    assert readiness.checks.pending_transactions is True
    assert readiness.blocking_reasons == []

    closed = await events.transition_status(seed["event"].id, EventStatus.CLOSED)
    assert closed.status == EventStatus.CLOSED


async def test_outstanding_blocks_close(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    events = EventService(db_session)
    invoices = ClientInvoiceService(db_session)

    invoice = await invoices.create(
        ClientInvoiceCreate(
            event_id=seed["event"].id,
            client_id=seed["client"].id,
            invoice_date=date(2026, 7, 1),
            amount=Decimal("50000.00"),
            gst_amount=Decimal("0"),
            total_amount=Decimal("50000.00"),
        )
    )
    await invoices.issue_invoice(invoice.id)

    await _advance_to_settlement(events, seed["event"].id)
    readiness = await events.financial_readiness(seed["event"].id)
    assert readiness.ready is False
    assert readiness.checks.outstanding is False
    assert any("Outstanding" in reason for reason in readiness.blocking_reasons)

    with pytest.raises(InvalidStateError, match="financial readiness"):
        await events.transition_status(seed["event"].id, EventStatus.CLOSED)


async def test_unattributed_spend_blocks_close(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    events = EventService(db_session)
    txns = TransactionService(db_session)

    txn = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("15000.00"),
            transaction_date=date(2026, 7, 2),
        )
    )
    await txns.transition_status(txn.id, TransactionStatus.COMPLETED)

    await _advance_to_settlement(events, seed["event"].id)
    readiness = await events.financial_readiness(seed["event"].id)
    assert readiness.checks.unattributed_spend is False
    assert any("Unattributed" in reason for reason in readiness.blocking_reasons)

    with pytest.raises(InvalidStateError, match="financial readiness"):
        await events.transition_status(seed["event"].id, EventStatus.CLOSED)


async def test_pending_vendor_payment_blocks_close(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    events = EventService(db_session)
    txns = TransactionService(db_session)

    category = await CostCategoryService(db_session).create(
        CostCategoryCreate(event_id=seed["event"].id, name="Vendor")
    )
    vendor_item = await CostItemService(db_session).create(
        CostItemCreate(
            event_id=seed["event"].id,
            category_id=category.id,
            title="AV",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("5000.00"),
            negotiated_amount=Decimal("5000.00"),
            vendor_required=True,
        )
    )
    vendor = await VendorService(db_session).create(VendorCreate(company_name="AV Co"))
    work_order = await VendorWorkOrderService(db_session).create(
        VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id)
    )
    await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=vendor_item.id,
            work_order_id=work_order.id,
            transaction_type=TransactionType.VENDOR_PAYMENT,
            payment_method=PaymentMethod.UPI,
            amount=Decimal("500.00"),
            transaction_date=date(2026, 7, 3),
        )
    )

    await _advance_to_settlement(events, seed["event"].id)
    readiness = await events.financial_readiness(seed["event"].id)
    assert readiness.checks.pending_transactions is False
    assert any("Pending Vendor Payment" in reason for reason in readiness.blocking_reasons)

    with pytest.raises(InvalidStateError, match="financial readiness"):
        await events.transition_status(seed["event"].id, EventStatus.CLOSED)


async def test_pending_client_receipt_blocks_close(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    events = EventService(db_session)
    invoices = ClientInvoiceService(db_session)
    txns = TransactionService(db_session)

    invoice = await invoices.create(
        ClientInvoiceCreate(
            event_id=seed["event"].id,
            client_id=seed["client"].id,
            invoice_date=date(2026, 7, 1),
            amount=Decimal("10000.00"),
            gst_amount=Decimal("0"),
            total_amount=Decimal("10000.00"),
        )
    )
    await invoices.issue_invoice(invoice.id)
    await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            client_invoice_id=invoice.id,
            transaction_type=TransactionType.CLIENT_RECEIPT,
            payment_method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("10000.00"),
            transaction_date=date(2026, 7, 4),
        )
    )

    await _advance_to_settlement(events, seed["event"].id)
    readiness = await events.financial_readiness(seed["event"].id)
    assert readiness.ready is False
    assert readiness.checks.pending_transactions is False
    assert readiness.checks.outstanding is False
    assert any("Pending Client Receipt" in reason for reason in readiness.blocking_reasons)

    with pytest.raises(InvalidStateError, match="financial readiness"):
        await events.transition_status(seed["event"].id, EventStatus.CLOSED)


async def test_closed_event_rejects_financial_mutations(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    events = EventService(db_session)
    txns = TransactionService(db_session)
    invoices = ClientInvoiceService(db_session)

    txn = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["item"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("2000.00"),
            transaction_date=date(2026, 7, 5),
        )
    )
    await txns.transition_status(txn.id, TransactionStatus.COMPLETED)

    invoice = await invoices.create(
        ClientInvoiceCreate(
            event_id=seed["event"].id,
            client_id=seed["client"].id,
            invoice_date=date(2026, 7, 1),
            amount=Decimal("2000.00"),
            gst_amount=Decimal("0"),
            total_amount=Decimal("2000.00"),
        )
    )
    await invoices.issue_invoice(invoice.id)
    receipt = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            client_invoice_id=invoice.id,
            transaction_type=TransactionType.CLIENT_RECEIPT,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("2000.00"),
            transaction_date=date(2026, 7, 6),
        )
    )
    await txns.transition_status(receipt.id, TransactionStatus.COMPLETED)

    await _advance_to_settlement(events, seed["event"].id)
    await events.transition_status(seed["event"].id, EventStatus.CLOSED)

    with pytest.raises(InvalidStateError):
        await txns.create(
            TransactionCreate(
                event_id=seed["event"].id,
                cost_item_id=seed["item"].id,
                transaction_type=TransactionType.INTERNAL_EXPENSE,
                payment_method=PaymentMethod.CASH,
                amount=Decimal("10.00"),
                transaction_date=date(2026, 7, 7),
            )
        )

    with pytest.raises(InvalidStateError):
        await txns.create(
            TransactionCreate(
                event_id=seed["event"].id,
                client_invoice_id=invoice.id,
                transaction_type=TransactionType.CLIENT_RECEIPT,
                payment_method=PaymentMethod.CASH,
                amount=Decimal("1.00"),
                transaction_date=date(2026, 7, 7),
            )
        )

    with pytest.raises(InvalidStateError):
        await txns.replace_allocations(
            txn.id,
            CostAllocationReplace(
                allocations=[
                    CostAllocationLine(
                        cost_item_id=seed["item"].id, allocated_amount=Decimal("2000.00")
                    )
                ]
            ),
        )

    with pytest.raises(InvalidStateError):
        await invoices.create(
            ClientInvoiceCreate(
                event_id=seed["event"].id,
                client_id=seed["client"].id,
                invoice_date=date(2026, 7, 8),
                amount=Decimal("100.00"),
                gst_amount=Decimal("0"),
                total_amount=Decimal("100.00"),
            )
        )

    with pytest.raises(InvalidStateError):
        await txns.transition_status(txn.id, TransactionStatus.REVERSED)


async def test_financial_readiness_api(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    seed = await _seed(db_session)
    event_id = str(seed["event"].id)

    ready = await api_client.get(f"/api/v1/events/{event_id}/financial-readiness")
    assert ready.status_code == 200
    body = ready.json()["data"]
    assert body["ready"] is True
    assert body["checks"] == {
        "outstanding": True,
        "unattributed_spend": True,
        "pending_transactions": True,
    }
    assert body["blocking_reasons"] == []

    invoices = ClientInvoiceService(db_session)
    invoice = await invoices.create(
        ClientInvoiceCreate(
            event_id=seed["event"].id,
            client_id=seed["client"].id,
            invoice_date=date(2026, 7, 1),
            amount=Decimal("50000.00"),
            gst_amount=Decimal("0"),
            total_amount=Decimal("50000.00"),
        )
    )
    await invoices.issue_invoice(invoice.id)

    blocked = await api_client.get(f"/api/v1/events/{event_id}/financial-readiness")
    assert blocked.status_code == 200
    data = blocked.json()["data"]
    assert data["ready"] is False
    assert data["checks"]["outstanding"] is False
    assert any("Outstanding invoices: ₹50000.00" in reason for reason in data["blocking_reasons"])

    events = EventService(db_session)
    await _advance_to_settlement(events, seed["event"].id)
    close = await api_client.patch(f"/api/v1/events/{event_id}", json={"status": "Closed"})
    assert close.status_code == 409
    assert close.json()["error"]["details"]
