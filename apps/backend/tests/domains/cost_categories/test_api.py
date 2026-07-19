"""Cost Categories API tests."""

from __future__ import annotations

import uuid

from httpx import AsyncClient


async def _event_id(api_client: AsyncClient) -> str:
    client_id = (await api_client.post("/api/v1/clients", json={"company_name": "Acme"})).json()[
        "data"
    ]["id"]
    return (
        await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "Gala"})
    ).json()["data"]["id"]


async def test_create_list_update_archive(api_client: AsyncClient) -> None:
    event_id = await _event_id(api_client)
    create = await api_client.post(
        "/api/v1/cost-categories",
        json={"event_id": event_id, "name": "Venue", "display_order": 1},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["success"] is True
    assert body["data"]["name"] == "Venue"
    category_id = body["data"]["id"]

    listed = await api_client.get(
        "/api/v1/cost-categories", params={"event_id": event_id, "q": "ven"}
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["pagination"]["total_items"] == 1

    patched = await api_client.patch(
        f"/api/v1/cost-categories/{category_id}", json={"display_order": 3}
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["display_order"] == 3

    deleted = await api_client.delete(f"/api/v1/cost-categories/{category_id}")
    assert deleted.status_code == 204
    follow = await api_client.get(f"/api/v1/cost-categories/{category_id}")
    assert follow.status_code == 404


async def test_duplicate_name_returns_409(api_client: AsyncClient) -> None:
    event_id = await _event_id(api_client)
    await api_client.post("/api/v1/cost-categories", json={"event_id": event_id, "name": "Venue"})
    resp = await api_client.post(
        "/api/v1/cost-categories", json={"event_id": event_id, "name": "Venue"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONFLICT"


async def test_missing_name_returns_422(api_client: AsyncClient) -> None:
    event_id = await _event_id(api_client)
    resp = await api_client.post("/api/v1/cost-categories", json={"event_id": event_id})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_unknown_returns_404(api_client: AsyncClient) -> None:
    resp = await api_client.get(f"/api/v1/cost-categories/{uuid.uuid4()}")
    assert resp.status_code == 404
