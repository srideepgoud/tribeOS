"""Clients REST API (thin controller). Routes follow ``docs/api_contract.md``.

No SQL and no business logic here — the router only translates HTTP to service
calls and wraps results in the standard envelope.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.clients.schemas import ClientCreate, ClientRead, ClientUpdate
from app.domains.clients.service import ClientService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/clients", tags=["clients"])


def get_client_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ClientService:
    return ClientService(session)


ServiceDep = Annotated[ClientService, Depends(get_client_service)]


@router.get("", response_model=PaginatedResponse[ClientRead])
async def list_clients(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -created_at,company_name")] = None,
) -> PaginatedResponse[ClientRead]:
    rows, total = await service.list(page=page, q=q, sort=sort)
    return PaginatedResponse[ClientRead](
        data=[ClientRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{client_id}", response_model=DataResponse[ClientRead])
async def get_client(client_id: uuid.UUID, service: ServiceDep) -> DataResponse[ClientRead]:
    client = await service.get(client_id)
    return DataResponse[ClientRead](data=ClientRead.model_validate(client))


@router.post("", response_model=DataResponse[ClientRead], status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[ClientRead]:
    client = await service.create(payload, actor=actor)
    return DataResponse[ClientRead](data=ClientRead.model_validate(client))


@router.patch("/{client_id}", response_model=DataResponse[ClientRead])
async def update_client(
    client_id: uuid.UUID, payload: ClientUpdate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[ClientRead]:
    client = await service.update(client_id, payload, actor=actor)
    return DataResponse[ClientRead](data=ClientRead.model_validate(client))


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(client_id: uuid.UUID, service: ServiceDep, actor: CurrentUser) -> Response:
    await service.archive(client_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
