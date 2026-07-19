"""Vendors REST API (thin controller)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.vendors.schemas import VendorCreate, VendorRead, VendorUpdate
from app.domains.vendors.service import VendorService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/vendors", tags=["vendors"])


def get_vendor_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> VendorService:
    return VendorService(session)


ServiceDep = Annotated[VendorService, Depends(get_vendor_service)]


@router.get("", response_model=PaginatedResponse[VendorRead])
async def list_vendors(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -created_at,company_name")] = None,
) -> PaginatedResponse[VendorRead]:
    rows, total = await service.list(page=page, q=q, sort=sort)
    return PaginatedResponse[VendorRead](
        data=[VendorRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{vendor_id}", response_model=DataResponse[VendorRead])
async def get_vendor(vendor_id: uuid.UUID, service: ServiceDep) -> DataResponse[VendorRead]:
    vendor = await service.get(vendor_id)
    return DataResponse[VendorRead](data=VendorRead.model_validate(vendor))


@router.post("", response_model=DataResponse[VendorRead], status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[VendorRead]:
    vendor = await service.create(payload, actor=actor)
    return DataResponse[VendorRead](data=VendorRead.model_validate(vendor))


@router.patch("/{vendor_id}", response_model=DataResponse[VendorRead])
async def update_vendor(
    vendor_id: uuid.UUID, payload: VendorUpdate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[VendorRead]:
    vendor = await service.update(vendor_id, payload, actor=actor)
    return DataResponse[VendorRead](data=VendorRead.model_validate(vendor))


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(vendor_id: uuid.UUID, service: ServiceDep, actor: CurrentUser) -> Response:
    await service.archive(vendor_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
