"""Vendors API tests."""

from __future__ import annotations

import uuid

from httpx import AsyncClient


async def test_crud_envelope_and_archive(api_client: AsyncClient) -> None:
    create = await api_client.post(
        "/api/v1/vendors",
        json={"company_name": "Audio Pro", "email": "a@audio.com"},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["success"] is True
    assert body["data"]["company_name"] == "Audio Pro"
    vendor_id = body["data"]["id"]

    listed = await api_client.get("/api/v1/vendors", params={"q": "audio", "page_size": 10})
    assert listed.status_code == 200
    assert listed.json()["meta"]["pagination"]["total_items"] == 1

    patched = await api_client.patch(f"/api/v1/vendors/{vendor_id}", json={"contact_name": "Ravi"})
    assert patched.status_code == 200
    assert patched.json()["data"]["contact_name"] == "Ravi"

    deleted = await api_client.delete(f"/api/v1/vendors/{vendor_id}")
    assert deleted.status_code == 204
    follow = await api_client.get(f"/api/v1/vendors/{vendor_id}")
    assert follow.status_code == 404


async def test_missing_company_name_422(api_client: AsyncClient) -> None:
    resp = await api_client.post("/api/v1/vendors", json={})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_unknown_404(api_client: AsyncClient) -> None:
    resp = await api_client.get(f"/api/v1/vendors/{uuid.uuid4()}")
    assert resp.status_code == 404
