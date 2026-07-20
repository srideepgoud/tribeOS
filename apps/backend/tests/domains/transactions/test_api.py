"""Transactions API tests."""

from __future__ import annotations

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService


async def _seed(session: AsyncSession) -> tuple[str, str]:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Ops")
    )
    item = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Meals",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("1000.00"),
        )
    )
    return str(event.id), str(item.id)


async def test_create_complete_no_delete(api_client: AsyncClient, db_session: AsyncSession) -> None:
    event_id, cost_item_id = await _seed(db_session)
    create = await api_client.post(
        "/api/v1/transactions",
        json={
            "event_id": event_id,
            "cost_item_id": cost_item_id,
            "transaction_type": "Internal Expense",
            "payment_method": "Cash",
            "amount": "250.00",
            "transaction_date": "2026-07-01",
            "reference_number": "REF-1",
        },
    )
    assert create.status_code == 201
    body = create.json()["data"]
    assert body["status"] == "Pending"
    txn_id = body["id"]

    listed = await api_client.get("/api/v1/transactions", params={"event_id": event_id, "q": "REF"})
    assert listed.status_code == 200
    assert listed.json()["meta"]["pagination"]["total_items"] == 1

    completed = await api_client.patch(
        f"/api/v1/transactions/{txn_id}", json={"status": "Completed"}
    )
    assert completed.status_code == 200
    assert completed.json()["data"]["status"] == "Completed"

    deleted = await api_client.delete(f"/api/v1/transactions/{txn_id}")
    assert deleted.status_code == 405

    allocations = await api_client.get(f"/api/v1/transactions/{txn_id}/allocations")
    assert allocations.status_code == 200
    assert len(allocations.json()["data"]) == 1
    assert allocations.json()["data"][0]["allocated_amount"] == "250.00"

    summary = await api_client.get(f"/api/v1/events/{event_id}/financial-summary")
    assert summary.status_code == 200
    assert summary.json()["data"]["cash_spent"] == "250.00"
    assert summary.json()["data"]["attributed_cost"] == "250.00"
    assert summary.json()["data"]["unattributed_spend"] == "0.00"
    assert summary.json()["data"]["billed_revenue"] == "0.00"
    assert summary.json()["data"]["cash_received"] == "0.00"
    assert summary.json()["data"]["outstanding"] == "0.00"
