"""Events REST API (thin controller). Routes follow ``docs/api_contract.md``.

Status on PATCH is not a normal field update — it dispatches to
``EventService.transition_status``. Field changes go through ``update``.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.current_user import CurrentUser
from app.db.session import get_session
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate, EventRead, EventUpdate
from app.domains.events.service import EventService
from app.shared.pagination import PageParams, pagination_params
from app.shared.schemas import DataResponse, PaginatedResponse, build_pagination_meta

router = APIRouter(prefix="/api/v1/events", tags=["events"])


def get_event_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EventService:
    return EventService(session)


ServiceDep = Annotated[EventService, Depends(get_event_service)]


@router.get("", response_model=PaginatedResponse[EventRead])
async def list_events(
    service: ServiceDep,
    page: Annotated[PageParams, Depends(pagination_params)],
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    sort: Annotated[str | None, Query(description="e.g. -start_datetime,name")] = None,
    status_filter: Annotated[
        EventStatus | None,
        Query(alias="status", description="Filter by EventStatus"),
    ] = None,
    client_id: Annotated[uuid.UUID | None, Query(description="Filter by client")] = None,
) -> PaginatedResponse[EventRead]:
    rows, total = await service.list(
        page=page, q=q, sort=sort, status=status_filter, client_id=client_id
    )
    return PaginatedResponse[EventRead](
        data=[EventRead.model_validate(row) for row in rows],
        meta=build_pagination_meta(page=page.page, page_size=page.page_size, total_items=total),
    )


@router.get("/{event_id}", response_model=DataResponse[EventRead])
async def get_event(event_id: uuid.UUID, service: ServiceDep) -> DataResponse[EventRead]:
    event = await service.get(event_id)
    return DataResponse[EventRead](data=EventRead.model_validate(event))


@router.post("", response_model=DataResponse[EventRead], status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[EventRead]:
    event = await service.create(payload, actor=actor)
    return DataResponse[EventRead](data=EventRead.model_validate(event))


@router.patch("/{event_id}", response_model=DataResponse[EventRead])
async def update_event(
    event_id: uuid.UUID, payload: EventUpdate, service: ServiceDep, actor: CurrentUser
) -> DataResponse[EventRead]:
    """Dispatch status changes to the state machine; other fields to ``update``."""
    data = payload.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)

    event = None
    if data:
        field_payload = EventUpdate.model_validate(data)
        event = await service.update(event_id, field_payload, actor=actor)
    if new_status is not None:
        event = await service.transition_status(event_id, new_status, actor=actor)
    if event is None:
        event = await service.get(event_id)

    return DataResponse[EventRead](data=EventRead.model_validate(event))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: uuid.UUID, service: ServiceDep, actor: CurrentUser) -> Response:
    await service.archive(event_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
