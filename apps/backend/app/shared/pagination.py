"""Shared pagination query parameters (see ``docs/api_contract.md``)."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Query


@dataclass(frozen=True)
class PageParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def pagination_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
) -> PageParams:
    """FastAPI dependency yielding validated pagination parameters."""
    return PageParams(page=page, page_size=page_size)
