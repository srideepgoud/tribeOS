"""Clients API tests (envelope, status codes, CRUD, validation) per api_contract.md."""

from __future__ import annotations

import uuid

from httpx import AsyncClient


async def test_create_returns_201_envelope(api_client: AsyncClient) -> None:
    resp = await api_client.post("/api/v1/clients", json={"company_name": "Acme"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["company_name"] == "Acme"
    assert body["data"]["archived_at"] is None


async def test_get_by_id(api_client: AsyncClient) -> None:
    created = (await api_client.post("/api/v1/clients", json={"company_name": "Acme"})).json()
    client_id = created["data"]["id"]
    resp = await api_client.get(f"/api/v1/clients/{client_id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == client_id


async def test_list_pagination_envelope(api_client: AsyncClient) -> None:
    for i in range(3):
        await api_client.post("/api/v1/clients", json={"company_name": f"Co {i}"})
    resp = await api_client.get("/api/v1/clients", params={"page": 1, "page_size": 2})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) == 2
    assert body["meta"]["pagination"]["total_items"] == 3
    assert body["meta"]["pagination"]["total_pages"] == 2


async def test_missing_company_name_returns_422(api_client: AsyncClient) -> None:
    resp = await api_client.post("/api/v1/clients", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert any(d["field"].endswith("company_name") for d in body["error"]["details"])


async def test_update_client(api_client: AsyncClient) -> None:
    created = (await api_client.post("/api/v1/clients", json={"company_name": "Acme"})).json()
    resp = await api_client.patch(f"/api/v1/clients/{created['data']['id']}", json={"notes": "VIP"})
    assert resp.status_code == 200
    assert resp.json()["data"]["notes"] == "VIP"


async def test_delete_is_soft_and_returns_204(api_client: AsyncClient) -> None:
    created = (await api_client.post("/api/v1/clients", json={"company_name": "Acme"})).json()
    client_id = created["data"]["id"]

    resp = await api_client.delete(f"/api/v1/clients/{client_id}")
    assert resp.status_code == 204

    follow_up = await api_client.get(f"/api/v1/clients/{client_id}")
    assert follow_up.status_code == 404
    assert follow_up.json()["error"]["code"] == "NOT_FOUND"


async def test_get_unknown_returns_404(api_client: AsyncClient) -> None:
    resp = await api_client.get(f"/api/v1/clients/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
