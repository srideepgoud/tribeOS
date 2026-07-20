"""Client Invoices REST API (thin controller). No DELETE — Cancel via status.

Partially Paid / Paid are never accepted as user status transitions (ADR 0013).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.client_invoices.models import ClientInvoice, ClientInvoiceStatus
from app.domains.client_invoices.schemas import (
    ClientInvoiceCreate,
    ClientInvoiceRead,
    ClientInvoiceUpdate,
    ClientInvoiceUserStatusAction,
)
from app.domains.client_invoices.service import ClientInvoiceService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/client-invoices", tags=["client-invoices"])


def get_client_invoice_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ClientInvoiceService:
    return ClientInvoiceService(session)


ServiceDep = Annotated[ClientInvoiceService, Depends(get_client_invoice_service)]


async def _to_read(service: ClientInvoiceService, invoice: ClientInvoice) -> ClientInvoiceRead:
    outstanding = await service.compute_outstanding(invoice.id)
    return ClientInvoiceRead.model_validate(invoice).model_copy(
        update={"outstanding": outstanding}
    )


@router.get("", response_model=PaginatedResponse[ClientInvoiceRead])
async def list_client_invoices(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -created_at,invoice_number")] = None,
    event_id: Annotated[uuid.UUID | None, Query()] = None,
    client_id: Annotated[uuid.UUID | None, Query()] = None,
    status_filter: Annotated[ClientInvoiceStatus | None, Query(alias="status")] = None,
) -> PaginatedResponse[ClientInvoiceRead]:
    rows, total = await service.list(
        page=page,
        q=q,
        sort=sort,
        event_id=event_id,
        client_id=client_id,
        status=status_filter,
    )
    data = [await _to_read(service, row) for row in rows]
    return PaginatedResponse[ClientInvoiceRead](
        data=data,
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{invoice_id}", response_model=DataResponse[ClientInvoiceRead])
async def get_client_invoice(
    invoice_id: uuid.UUID, service: ServiceDep
) -> DataResponse[ClientInvoiceRead]:
    invoice = await service.get(invoice_id)
    return DataResponse[ClientInvoiceRead](data=await _to_read(service, invoice))


@router.post(
    "", response_model=DataResponse[ClientInvoiceRead], status_code=status.HTTP_201_CREATED
)
async def create_client_invoice(
    payload: ClientInvoiceCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[ClientInvoiceRead]:
    invoice = await service.create(payload, actor=actor)
    return DataResponse[ClientInvoiceRead](data=await _to_read(service, invoice))


@router.patch("/{invoice_id}", response_model=DataResponse[ClientInvoiceRead])
async def update_client_invoice(
    invoice_id: uuid.UUID,
    payload: ClientInvoiceUpdate,
    service: ServiceDep,
    actor: CurrentUser,
) -> DataResponse[ClientInvoiceRead]:
    data = payload.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)

    invoice = None
    if data:
        field_payload = ClientInvoiceUpdate.model_validate(data)
        invoice = await service.update_draft(invoice_id, field_payload, actor=actor)
    if new_status is not None:
        action = ClientInvoiceUserStatusAction(new_status)
        if action == ClientInvoiceUserStatusAction.ISSUED:
            invoice = await service.issue_invoice(invoice_id, actor=actor)
        else:
            invoice = await service.cancel_invoice(invoice_id, actor=actor)
    if invoice is None:
        invoice = await service.get(invoice_id)

    return DataResponse[ClientInvoiceRead](data=await _to_read(service, invoice))
