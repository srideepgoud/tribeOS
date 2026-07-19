"""Cost Categories REST API (thin controller)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.cost_categories.schemas import (
    CostCategoryCreate,
    CostCategoryRead,
    CostCategoryUpdate,
)
from app.domains.cost_categories.service import CostCategoryService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/cost-categories", tags=["cost-categories"])


def get_cost_category_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CostCategoryService:
    return CostCategoryService(session)


ServiceDep = Annotated[CostCategoryService, Depends(get_cost_category_service)]


@router.get("", response_model=PaginatedResponse[CostCategoryRead])
async def list_cost_categories(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. display_order,name")] = None,
    event_id: Annotated[uuid.UUID | None, Query(description="Filter by event")] = None,
) -> PaginatedResponse[CostCategoryRead]:
    rows, total = await service.list(page=page, q=q, sort=sort, event_id=event_id)
    return PaginatedResponse[CostCategoryRead](
        data=[CostCategoryRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{category_id}", response_model=DataResponse[CostCategoryRead])
async def get_cost_category(
    category_id: uuid.UUID, service: ServiceDep
) -> DataResponse[CostCategoryRead]:
    category = await service.get(category_id)
    return DataResponse[CostCategoryRead](data=CostCategoryRead.model_validate(category))


@router.post("", response_model=DataResponse[CostCategoryRead], status_code=status.HTTP_201_CREATED)
async def create_cost_category(
    payload: CostCategoryCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[CostCategoryRead]:
    category = await service.create(payload, actor=actor)
    return DataResponse[CostCategoryRead](data=CostCategoryRead.model_validate(category))


@router.patch("/{category_id}", response_model=DataResponse[CostCategoryRead])
async def update_cost_category(
    category_id: uuid.UUID,
    payload: CostCategoryUpdate,
    service: ServiceDep,
    actor: CurrentUser,
) -> DataResponse[CostCategoryRead]:
    category = await service.update(category_id, payload, actor=actor)
    return DataResponse[CostCategoryRead](data=CostCategoryRead.model_validate(category))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cost_category(
    category_id: uuid.UUID, service: ServiceDep, actor: CurrentUser
) -> Response:
    await service.archive(category_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
