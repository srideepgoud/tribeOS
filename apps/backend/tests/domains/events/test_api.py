"""Events API tests (envelope, filters, state machine 409, soft archive)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient


async def _create_client(api_client: AsyncClient, name: str = "Acme") -> str:
    resp = await api_client.post("/api/v1/clients", json={"company_name": name})
    assert resp.status_code == 201
    return resp.json()["data"]["id"]


async def test_create_returns_201_draft(api_client: AsyncClient) -> None:
    client_id = await _create_client(api_client)
    resp = await api_client.post(
        "/api/v1/events",
        json={"client_id": client_id, "name": "Wedding", "expected_revenue": "25000.00"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "Draft"
    assert body["data"]["name"] == "Wedding"
    assert body["data"]["expected_revenue"] == "25000.00"
    assert body["data"]["client_id"] == client_id


async def test_list_filters_and_pagination(api_client: AsyncClient) -> None:
    client_a = await _create_client(api_client, "A")
    client_b = await _create_client(api_client, "B")
    await api_client.post("/api/v1/events", json={"client_id": client_a, "name": "Alpha Wedding"})
    await api_client.post("/api/v1/events", json={"client_id": client_a, "name": "Beta Corp"})
    await api_client.post("/api/v1/events", json={"client_id": client_b, "name": "Gamma Wedding"})

    resp = await api_client.get("/api/v1/events", params={"q": "wedding", "page_size": 10})
    assert resp.status_code == 200
    assert resp.json()["meta"]["pagination"]["total_items"] == 2

    resp = await api_client.get("/api/v1/events", params={"client_id": client_b})
    assert resp.json()["meta"]["pagination"]["total_items"] == 1

    # Move one to Planning then filter
    event_id = (
        await api_client.post("/api/v1/events", json={"client_id": client_a, "name": "Plan me"})
    ).json()["data"]["id"]
    await api_client.patch(f"/api/v1/events/{event_id}", json={"status": "Planning"})
    resp = await api_client.get("/api/v1/events", params={"status": "Planning"})
    assert resp.json()["meta"]["pagination"]["total_items"] == 1
    assert resp.json()["data"][0]["status"] == "Planning"


async def test_invalid_transition_returns_409(api_client: AsyncClient) -> None:
    client_id = await _create_client(api_client)
    event_id = (
        await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "Jump"})
    ).json()["data"]["id"]
    resp = await api_client.patch(f"/api/v1/events/{event_id}", json={"status": "Execution"})
    assert resp.status_code == 409
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_STATE"


async def test_closed_patch_returns_409(api_client: AsyncClient) -> None:
    client_id = await _create_client(api_client)
    event_id = (
        await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "Lock"})
    ).json()["data"]["id"]
    for status in (
        "Planning",
        "Commercials",
        "Procurement",
        "Execution",
        "Settlement",
        "Closed",
    ):
        patch = await api_client.patch(f"/api/v1/events/{event_id}", json={"status": status})
        assert patch.status_code == 200, patch.text

    resp = await api_client.patch(f"/api/v1/events/{event_id}", json={"notes": "nope"})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


async def test_delete_draft_soft_archives(api_client: AsyncClient) -> None:
    client_id = await _create_client(api_client)
    event_id = (
        await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "Archive"})
    ).json()["data"]["id"]
    resp = await api_client.delete(f"/api/v1/events/{event_id}")
    assert resp.status_code == 204
    follow = await api_client.get(f"/api/v1/events/{event_id}")
    assert follow.status_code == 404


async def test_delete_non_draft_returns_409(api_client: AsyncClient) -> None:
    client_id = await _create_client(api_client)
    event_id = (
        await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "No archive"})
    ).json()["data"]["id"]
    await api_client.patch(f"/api/v1/events/{event_id}", json={"status": "Planning"})
    resp = await api_client.delete(f"/api/v1/events/{event_id}")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


async def test_client_archive_blocked_via_api(api_client: AsyncClient) -> None:
    client_id = await _create_client(api_client, "Has Events")
    await api_client.post("/api/v1/events", json={"client_id": client_id, "name": "Blocker"})
    resp = await api_client.delete(f"/api/v1/clients/{client_id}")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONFLICT"


async def test_get_unknown_returns_404(api_client: AsyncClient) -> None:
    resp = await api_client.get(f"/api/v1/events/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
