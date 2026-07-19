"""Shared API response envelopes (see ``docs/api_contract.md``).

Success responses always use ``{"success": true, "data": ..., "meta"?: ...}``.
Error responses are produced centrally in ``app/api/errors/handlers.py``.
"""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class ListMeta(BaseModel):
    pagination: PaginationMeta


class DataResponse(BaseModel, Generic[T]):  # noqa: UP046
    """Envelope for a single resource."""

    success: bool = True
    data: T


class PaginatedResponse(BaseModel, Generic[T]):  # noqa: UP046
    """Envelope for a paginated collection."""

    success: bool = True
    data: list[T]
    meta: ListMeta


def build_pagination_meta(*, page: int, page_size: int, total_items: int) -> ListMeta:
    total_pages = (total_items + page_size - 1) // page_size if page_size else 0
    return ListMeta(
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        )
    )
