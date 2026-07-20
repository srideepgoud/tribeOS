"""Phase 11 — Operations Dashboard aggregation and API tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.client_invoices.schemas import ClientInvoiceCreate
from app.domains.client_invoices.service import ClientInvoiceService
from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.dashboard.service import DashboardService
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.transactions.models import PaymentMethod, TransactionStatus, TransactionType
from app.domains.transactions.schemas import TransactionCreate
from app.domains.transactions.service import TransactionService


async def _seed_client_event(session: AsyncSession, *, name: str = "Dash Fest") -> dict:
    client = await ClientService(session).create(ClientCreate(company_name="Dash Co"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name=name))
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


async def _advance_to(service: EventService, event_id, target: EventStatus) -> None:
    path = [
        EventStatus.PLANNING,
        EventStatus.COMMERCIALS,
        EventStatus.PROCUREMENT,
        EventStatus.EXECUTION,
        EventStatus.SETTLEMENT,
        EventStatus.CLOSED,
    ]
    for status in path:
        await service.transition_status(event_id, status)
        if status == target:
            return


async def test_empty_dashboard(db_session: AsyncSession) -> None:
    dashboard = await DashboardService(db_session).get_operations_dashboard()
    assert dashboard.overview.active_events == 0
    assert dashboard.overview.settlement_events == 0
    assert dashboard.overview.closed_events == 0
    assert dashboard.overview.ready_to_close == 0
    assert dashboard.finance.billed_revenue == Decimal("0")
    assert dashboard.finance.gross_profit == Decimal("0")
    assert dashboard.attention.outstanding_events == 0
    assert dashboard.events == []


async def test_overview_counts_and_event_list(db_session: AsyncSession) -> None:
    seed_a = await _seed_client_event(db_session, name="Active One")
    seed_b = await _seed_client_event(db_session, name="Settlement One")
    seed_c = await _seed_client_event(db_session, name="Closed One")
    events = EventService(db_session)

    await events.transition_status(seed_a["event"].id, EventStatus.PLANNING)
    await _advance_to(events, seed_b["event"].id, EventStatus.SETTLEMENT)
    await _advance_to(events, seed_c["event"].id, EventStatus.CLOSED)

    dashboard = await DashboardService(db_session).get_operations_dashboard()
    assert dashboard.overview.active_events == 1
    assert dashboard.overview.settlement_events == 1
    assert dashboard.overview.closed_events == 1
    names = {row.name for row in dashboard.events}
    assert "Active One" in names
    assert "Settlement One" in names
    assert "Closed One" not in names
    assert all(row.client_name == "Dash Co" for row in dashboard.events)


async def test_finance_totals_and_gross_profit(db_session: AsyncSession) -> None:
    seed = await _seed_client_event(db_session)
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

    txn = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["item"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("2500.00"),
            transaction_date=date(2026, 7, 2),
        )
    )
    await txns.transition_status(txn.id, TransactionStatus.COMPLETED)

    dashboard = await DashboardService(db_session).get_operations_dashboard()
    assert dashboard.finance.billed_revenue == Decimal("10000.00")
    assert dashboard.finance.attributed_cost == Decimal("2500.00")
    assert dashboard.finance.cash_spent == Decimal("2500.00")
    assert dashboard.finance.gross_profit == Decimal("7500.00")
    assert dashboard.events[0].gross_profit == Decimal("7500.00")


async def test_attention_counts_and_readiness(db_session: AsyncSession) -> None:
    seed = await _seed_client_event(db_session, name="Attention Fest")
    events = EventService(db_session)
    invoices = ClientInvoiceService(db_session)
    txns = TransactionService(db_session)

    invoice = await invoices.create(
        ClientInvoiceCreate(
            event_id=seed["event"].id,
            client_id=seed["client"].id,
            invoice_date=date(2026, 7, 1),
            amount=Decimal("5000.00"),
            gst_amount=Decimal("0"),
            total_amount=Decimal("5000.00"),
        )
    )
    await invoices.issue_invoice(invoice.id)

    pending = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["item"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("100.00"),
            transaction_date=date(2026, 7, 2),
        )
    )
    assert pending.status == TransactionStatus.PENDING

    unattributed = await txns.create(
        TransactionCreate(
            event_id=seed["event"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("200.00"),
            transaction_date=date(2026, 7, 3),
        )
    )
    await txns.transition_status(unattributed.id, TransactionStatus.COMPLETED)

    await _advance_to(events, seed["event"].id, EventStatus.SETTLEMENT)

    dashboard = await DashboardService(db_session).get_operations_dashboard()
    assert dashboard.attention.outstanding_events == 1
    assert dashboard.attention.pending_transactions == 1
    assert dashboard.attention.unattributed_events == 1
    assert dashboard.attention.ready_to_close_events == 0
    assert dashboard.overview.ready_to_close == 0
    assert dashboard.events[0].financial_ready is False


async def test_ready_to_close_settlement_event(db_session: AsyncSession) -> None:
    seed = await _seed_client_event(db_session, name="Ready Fest")
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
    await _advance_to(events, seed["event"].id, EventStatus.SETTLEMENT)

    readiness = await events.financial_readiness(seed["event"].id)
    assert readiness.ready is True

    dashboard = await DashboardService(db_session).get_operations_dashboard()
    assert dashboard.overview.ready_to_close == 1
    assert dashboard.attention.ready_to_close_events == 1
    row = next(r for r in dashboard.events if r.name == "Ready Fest")
    assert row.financial_ready is True
    assert row.status == EventStatus.SETTLEMENT


async def test_operations_api_envelope(api_client: AsyncClient) -> None:
    resp = await api_client.get("/api/v1/dashboard/operations")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert set(data.keys()) == {"overview", "finance", "attention", "events"}
    assert set(data["overview"].keys()) == {
        "active_events",
        "settlement_events",
        "closed_events",
        "ready_to_close",
    }
    assert set(data["finance"].keys()) == {
        "billed_revenue",
        "cash_received",
        "outstanding",
        "cash_spent",
        "attributed_cost",
        "gross_profit",
    }
    assert data["finance"]["billed_revenue"] == "0.00"
    assert data["events"] == []


async def test_operations_api_with_seeded_data(api_client: AsyncClient) -> None:
    client_id = (
        await api_client.post("/api/v1/clients", json={"company_name": "API Dash"})
    ).json()["data"]["id"]
    event_id = (
        await api_client.post(
            "/api/v1/events",
            json={"client_id": client_id, "name": "API Event"},
        )
    ).json()["data"]["id"]
    await api_client.patch(f"/api/v1/events/{event_id}", json={"status": "Planning"})

    resp = await api_client.get("/api/v1/dashboard/operations")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["overview"]["active_events"] == 1
    assert data["events"][0]["name"] == "API Event"
    assert data["events"][0]["client_name"] == "API Dash"
    assert data["events"][0]["financial_ready"] is True
