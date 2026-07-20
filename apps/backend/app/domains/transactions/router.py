"""Transactions REST API (thin controller). No DELETE.

Cost Allocation endpoints are nested here (ADR 0009 / 0012) — no standalone router.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.cost_allocations.schemas import CostAllocationRead, CostAllocationReplace
from app.domains.transactions.models import TransactionStatus, TransactionType
from app.domains.transactions.schemas import TransactionCreate, TransactionRead, TransactionUpdate
from app.domains.transactions.service import TransactionService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def get_transaction_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TransactionService:
    return TransactionService(session)


ServiceDep = Annotated[TransactionService, Depends(get_transaction_service)]


@router.get("", response_model=PaginatedResponse[TransactionRead])
async def list_transactions(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -created_at,amount")] = None,
    event_id: Annotated[uuid.UUID | None, Query()] = None,
    cost_item_id: Annotated[uuid.UUID | None, Query()] = None,
    work_order_id: Annotated[uuid.UUID | None, Query()] = None,
    client_invoice_id: Annotated[uuid.UUID | None, Query()] = None,
    transaction_type: Annotated[TransactionType | None, Query()] = None,
    status_filter: Annotated[TransactionStatus | None, Query(alias="status")] = None,
) -> PaginatedResponse[TransactionRead]:
    rows, total = await service.list(
        page=page,
        q=q,
        sort=sort,
        event_id=event_id,
        cost_item_id=cost_item_id,
        work_order_id=work_order_id,
        client_invoice_id=client_invoice_id,
        transaction_type=transaction_type,
        status=status_filter,
    )
    return PaginatedResponse[TransactionRead](
        data=[TransactionRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{transaction_id}", response_model=DataResponse[TransactionRead])
async def get_transaction(
    transaction_id: uuid.UUID, service: ServiceDep
) -> DataResponse[TransactionRead]:
    transaction = await service.get(transaction_id)
    return DataResponse[TransactionRead](data=TransactionRead.model_validate(transaction))


@router.post("", response_model=DataResponse[TransactionRead], status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[TransactionRead]:
    transaction = await service.create(payload, actor=actor)
    return DataResponse[TransactionRead](data=TransactionRead.model_validate(transaction))


@router.patch("/{transaction_id}", response_model=DataResponse[TransactionRead])
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    service: ServiceDep,
    actor: CurrentUser,
) -> DataResponse[TransactionRead]:
    data = payload.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)
    allocations = data.pop("allocations", None)

    transaction = None
    field_keys = set(data.keys())
    if field_keys or allocations is not None:
        field_payload = TransactionUpdate.model_validate(
            {**data, **({"allocations": allocations} if allocations is not None else {})}
        )
        transaction = await service.update(transaction_id, field_payload, actor=actor)
    if new_status is not None:
        transaction = await service.transition_status(transaction_id, new_status, actor=actor)
    if transaction is None:
        transaction = await service.get(transaction_id)

    return DataResponse[TransactionRead](data=TransactionRead.model_validate(transaction))


@router.get(
    "/{transaction_id}/allocations",
    response_model=DataResponse[list[CostAllocationRead]],
)
async def list_transaction_allocations(
    transaction_id: uuid.UUID, service: ServiceDep
) -> DataResponse[list[CostAllocationRead]]:
    rows = await service.list_allocations(transaction_id)
    return DataResponse[list[CostAllocationRead]](
        data=[CostAllocationRead.model_validate(row) for row in rows]
    )


@router.put(
    "/{transaction_id}/allocations",
    response_model=DataResponse[list[CostAllocationRead]],
)
async def replace_transaction_allocations(
    transaction_id: uuid.UUID,
    payload: CostAllocationReplace,
    service: ServiceDep,
    actor: CurrentUser,
) -> DataResponse[list[CostAllocationRead]]:
    rows = await service.replace_allocations(transaction_id, payload, actor=actor)
    return DataResponse[list[CostAllocationRead]](
        data=[CostAllocationRead.model_validate(row) for row in rows]
    )
