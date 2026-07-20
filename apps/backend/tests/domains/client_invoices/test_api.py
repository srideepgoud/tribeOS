"""Client Invoices API + receipt / settlement integration tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService


async def _seed(session: AsyncSession) -> tuple[str, str]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    return str(client.id), str(event.id)


async def _advance_to_settlement(api_client: AsyncClient, event_id: str) -> None:
    path = [
        EventStatus.PLANNING,
        EventStatus.COMMERCIALS,
        EventStatus.PROCUREMENT,
        EventStatus.EXECUTION,
        EventStatus.SETTLEMENT,
    ]
    for status in path:
        response = await api_client.patch(
            f"/api/v1/events/{event_id}", json={"status": status.value}
        )
        assert response.status_code == 200, response.text


async def test_invoice_lifecycle_receipt_and_summary(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    client_id, event_id = await _seed(db_session)

    create = await api_client.post(
        "/api/v1/client-invoices",
        json={
            "event_id": event_id,
            "client_id": client_id,
            "invoice_date": "2026-07-01",
            "amount": "100000.00",
            "gst_amount": "0.00",
            "total_amount": "100000.00",
            "notes": "Main billing",
        },
    )
    assert create.status_code == 201
    invoice = create.json()["data"]
    assert invoice["status"] == "Draft"
    assert invoice["outstanding"] == "100000.00"
    assert invoice["invoice_number"].startswith("INV-")
    invoice_id = invoice["id"]

    issued = await api_client.patch(
        f"/api/v1/client-invoices/{invoice_id}", json={"status": "Issued"}
    )
    assert issued.status_code == 200
    assert issued.json()["data"]["status"] == "Issued"

    mark_paid = await api_client.patch(
        f"/api/v1/client-invoices/{invoice_id}", json={"status": "Paid"}
    )
    assert mark_paid.status_code == 422

    receipt = await api_client.post(
        "/api/v1/transactions",
        json={
            "event_id": event_id,
            "client_invoice_id": invoice_id,
            "transaction_type": "Client Receipt",
            "payment_method": "Bank Transfer",
            "amount": "40000.00",
            "transaction_date": "2026-07-10",
        },
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["data"]["id"]

    completed = await api_client.patch(
        f"/api/v1/transactions/{receipt_id}", json={"status": "Completed"}
    )
    assert completed.status_code == 200

    detail = await api_client.get(f"/api/v1/client-invoices/{invoice_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["status"] == "Partially Paid"
    assert detail.json()["data"]["outstanding"] == "60000.00"

    overpay = await api_client.post(
        "/api/v1/transactions",
        json={
            "event_id": event_id,
            "client_invoice_id": invoice_id,
            "transaction_type": "Client Receipt",
            "payment_method": "Cash",
            "amount": "70000.00",
            "transaction_date": "2026-07-11",
        },
    )
    assert overpay.status_code == 409

    receipt2 = await api_client.post(
        "/api/v1/transactions",
        json={
            "event_id": event_id,
            "client_invoice_id": invoice_id,
            "transaction_type": "Client Receipt",
            "payment_method": "UPI",
            "amount": "60000.00",
            "transaction_date": "2026-07-12",
        },
    )
    assert receipt2.status_code == 201
    receipt2_id = receipt2.json()["data"]["id"]
    done = await api_client.patch(
        f"/api/v1/transactions/{receipt2_id}", json={"status": "Completed"}
    )
    assert done.status_code == 200

    paid = await api_client.get(f"/api/v1/client-invoices/{invoice_id}")
    assert paid.json()["data"]["status"] == "Paid"
    assert paid.json()["data"]["outstanding"] == "0.00"

    history = await api_client.get(
        "/api/v1/transactions", params={"client_invoice_id": invoice_id}
    )
    assert history.status_code == 200
    assert history.json()["meta"]["pagination"]["total_items"] == 2

    summary = await api_client.get(f"/api/v1/events/{event_id}/financial-summary")
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["billed_revenue"] == "100000.00"
    assert data["cash_received"] == "100000.00"
    assert data["outstanding"] == "0.00"
    assert data["cash_spent"] == "0.00"

    reversed_txn = await api_client.patch(
        f"/api/v1/transactions/{receipt2_id}", json={"status": "Reversed"}
    )
    assert reversed_txn.status_code == 200
    after = await api_client.get(f"/api/v1/client-invoices/{invoice_id}")
    assert after.json()["data"]["status"] == "Partially Paid"
    assert after.json()["data"]["outstanding"] == "60000.00"


async def test_settlement_close_blocked_by_outstanding(
    api_client: AsyncClient, db_session: AsyncSession
) -> None:
    client_id, event_id = await _seed(db_session)
    create = await api_client.post(
        "/api/v1/client-invoices",
        json={
            "event_id": event_id,
            "client_id": client_id,
            "invoice_date": str(date(2026, 7, 1)),
            "amount": "5000.00",
            "gst_amount": "0.00",
            "total_amount": "5000.00",
        },
    )
    invoice_id = create.json()["data"]["id"]
    await api_client.patch(f"/api/v1/client-invoices/{invoice_id}", json={"status": "Issued"})

    await _advance_to_settlement(api_client, event_id)
    blocked = await api_client.patch(
        f"/api/v1/events/{event_id}", json={"status": "Closed"}
    )
    assert blocked.status_code == 409

    receipt = await api_client.post(
        "/api/v1/transactions",
        json={
            "event_id": event_id,
            "client_invoice_id": invoice_id,
            "transaction_type": "Client Receipt",
            "payment_method": "Cash",
            "amount": "5000.00",
            "transaction_date": "2026-07-20",
        },
    )
    receipt_id = receipt.json()["data"]["id"]
    await api_client.patch(f"/api/v1/transactions/{receipt_id}", json={"status": "Completed"})

    closed = await api_client.patch(f"/api/v1/events/{event_id}", json={"status": "Closed"})
    assert closed.status_code == 200
    assert closed.json()["data"]["status"] == "Closed"
