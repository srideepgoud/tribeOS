"""Vendor Work Orders REST API (thin controller). No DELETE — Cancel via status."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.vendor_work_orders.models import VendorWorkOrderStatus
from app.domains.vendor_work_orders.schemas import (
    VendorWorkOrderCreate,
    VendorWorkOrderRead,
    VendorWorkOrderUpdate,
)
from app.domains.vendor_work_orders.service import VendorWorkOrderService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/vendor-work-orders", tags=["vendor-work-orders"])


def get_vendor_work_order_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> VendorWorkOrderService:
    return VendorWorkOrderService(session)


ServiceDep = Annotated[VendorWorkOrderService, Depends(get_vendor_work_order_service)]


@router.get("", response_model=PaginatedResponse[VendorWorkOrderRead])
async def list_vendor_work_orders(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -created_at,work_order_number")] = None,
    vendor_id: Annotated[uuid.UUID | None, Query()] = None,
    cost_item_id: Annotated[uuid.UUID | None, Query()] = None,
    status_filter: Annotated[VendorWorkOrderStatus | None, Query(alias="status")] = None,
) -> PaginatedResponse[VendorWorkOrderRead]:
    rows, total = await service.list(
        page=page,
        q=q,
        sort=sort,
        vendor_id=vendor_id,
        cost_item_id=cost_item_id,
        status=status_filter,
    )
    return PaginatedResponse[VendorWorkOrderRead](
        data=[VendorWorkOrderRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{work_order_id}", response_model=DataResponse[VendorWorkOrderRead])
async def get_vendor_work_order(
    work_order_id: uuid.UUID, service: ServiceDep
) -> DataResponse[VendorWorkOrderRead]:
    work_order = await service.get(work_order_id)
    return DataResponse[VendorWorkOrderRead](data=VendorWorkOrderRead.model_validate(work_order))


@router.post(
    "", response_model=DataResponse[VendorWorkOrderRead], status_code=status.HTTP_201_CREATED
)
async def create_vendor_work_order(
    payload: VendorWorkOrderCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[VendorWorkOrderRead]:
    work_order = await service.create(payload, actor=actor)
    return DataResponse[VendorWorkOrderRead](data=VendorWorkOrderRead.model_validate(work_order))


@router.patch("/{work_order_id}", response_model=DataResponse[VendorWorkOrderRead])
async def update_vendor_work_order(
    work_order_id: uuid.UUID,
    payload: VendorWorkOrderUpdate,
    service: ServiceDep,
    actor: CurrentUser,
) -> DataResponse[VendorWorkOrderRead]:
    data = payload.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)

    work_order = None
    if data:
        field_payload = VendorWorkOrderUpdate.model_validate(data)
        work_order = await service.update(work_order_id, field_payload, actor=actor)
    if new_status is not None:
        work_order = await service.transition_status(work_order_id, new_status, actor=actor)
    if work_order is None:
        work_order = await service.get(work_order_id)

    return DataResponse[VendorWorkOrderRead](data=VendorWorkOrderRead.model_validate(work_order))
