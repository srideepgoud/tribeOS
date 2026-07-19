"""Cost Items REST API (thin controller)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.cost_items.models import CostItemStatus
from app.domains.cost_items.schemas import (
    CostItemCreate,
    CostItemRead,
    CostItemUpdate,
    CostItemVersionRead,
)
from app.domains.cost_items.service import CostItemService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/cost-items", tags=["cost-items"])


def get_cost_item_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CostItemService:
    return CostItemService(session)


ServiceDep = Annotated[CostItemService, Depends(get_cost_item_service)]


@router.get("", response_model=PaginatedResponse[CostItemRead])
async def list_cost_items(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -created_at,title")] = None,
    event_id: Annotated[uuid.UUID | None, Query()] = None,
    category_id: Annotated[uuid.UUID | None, Query()] = None,
    status_filter: Annotated[CostItemStatus | None, Query(alias="status")] = None,
) -> PaginatedResponse[CostItemRead]:
    rows, total = await service.list(
        page=page,
        q=q,
        sort=sort,
        event_id=event_id,
        category_id=category_id,
        status=status_filter,
    )
    return PaginatedResponse[CostItemRead](
        data=[CostItemRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{item_id}", response_model=DataResponse[CostItemRead])
async def get_cost_item(item_id: uuid.UUID, service: ServiceDep) -> DataResponse[CostItemRead]:
    item = await service.get(item_id)
    return DataResponse[CostItemRead](data=CostItemRead.model_validate(item))


@router.get("/{item_id}/versions", response_model=DataResponse[list[CostItemVersionRead]])
async def list_cost_item_versions(
    item_id: uuid.UUID, service: ServiceDep
) -> DataResponse[list[CostItemVersionRead]]:
    versions = await service.list_versions(item_id)
    return DataResponse[list[CostItemVersionRead]](
        data=[CostItemVersionRead.model_validate(v) for v in versions]
    )


@router.post("", response_model=DataResponse[CostItemRead], status_code=status.HTTP_201_CREATED)
async def create_cost_item(
    payload: CostItemCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[CostItemRead]:
    item = await service.create(payload, actor=actor)
    return DataResponse[CostItemRead](data=CostItemRead.model_validate(item))


@router.patch("/{item_id}", response_model=DataResponse[CostItemRead])
async def update_cost_item(
    item_id: uuid.UUID, payload: CostItemUpdate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[CostItemRead]:
    data = payload.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)

    item = None
    if data:
        field_payload = CostItemUpdate.model_validate(data)
        item = await service.update(item_id, field_payload, actor=actor)
    if new_status is not None:
        item = await service.transition_status(item_id, new_status, actor=actor)
    if item is None:
        item = await service.get(item_id)

    return DataResponse[CostItemRead](data=CostItemRead.model_validate(item))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cost_item(item_id: uuid.UUID, service: ServiceDep, actor: CurrentUser) -> Response:
    await service.archive(item_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
