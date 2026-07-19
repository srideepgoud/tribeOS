"""Cost Items API tests."""

from __future__ import annotations

import uuid
from httpx import AsyncClient


async def _seed(api_client: AsyncClient) -> tuple[str, str]:
    client_id = (await api_client.post("/api/v1/clients", json={"company_name": "Acme"})).json()[
        "data"
    ]["id"]
    event_id = (
        await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "Gala"})
    ).json()["data"]["id"]
    category_id = (
        await api_client.post(
            "/api/v1/cost-categories", json={"event_id": event_id, "name": "Venue"}
        )
    ).json()["data"]["id"]
    return event_id, category_id


async def test_crud_version_and_budget_lock(api_client: AsyncClient) -> None:
    event_id, category_id = await _seed(api_client)
    create = await api_client.post(
        "/api/v1/cost-items",
        json={
            "event_id": event_id,
            "category_id": category_id,
            "title": "Ballroom",
            "expense_type": "Vendor",
            "budget_amount": "100000.00",
            "vendor_required": True,
        },
    )
    assert create.status_code == 201
    body = create.json()["data"]
    assert body["status"] == "Planned"
    assert body["actual_amount"] is None
    item_id = body["id"]

    patched = await api_client.patch(
        f"/api/v1/cost-items/{item_id}", json={"budget_amount": "110000.00"}
    )
    assert patched.status_code == 200
    versions = await api_client.get(f"/api/v1/cost-items/{item_id}/versions")
    assert versions.status_code == 200
    assert len(versions.json()["data"]) == 1
    assert versions.json()["data"][0]["budget_amount"] == "100000.00"

    await api_client.patch(f"/api/v1/cost-items/{item_id}", json={"status": "Approved"})
    locked = await api_client.patch(f"/api/v1/cost-items/{item_id}", json={"budget_amount": "1.00"})
    assert locked.status_code == 409
    assert locked.json()["error"]["code"] == "INVALID_STATE"

    deleted = await api_client.delete(f"/api/v1/cost-items/{item_id}")
    # Approved items can still be archived in Phase 4 (not Completed)
    assert deleted.status_code == 204


async def test_list_filters(api_client: AsyncClient) -> None:
    event_id, category_id = await _seed(api_client)
    await api_client.post(
        "/api/v1/cost-items",
        json={
            "event_id": event_id,
            "category_id": category_id,
            "title": "LED Wall",
            "expense_type": "Vendor",
            "budget_amount": "50000",
            "vendor_required": True,
        },
    )
    resp = await api_client.get("/api/v1/cost-items", params={"event_id": event_id, "q": "led"})
    assert resp.status_code == 200
    assert resp.json()["meta"]["pagination"]["total_items"] == 1


async def test_unknown_404(api_client: AsyncClient) -> None:
    resp = await api_client.get(f"/api/v1/cost-items/{uuid.uuid4()}")
    assert resp.status_code == 404
