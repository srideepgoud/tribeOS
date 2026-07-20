"""Pydantic request/response schemas for the Events API.

Transport validation only (ADR 0007). State transitions and cross-entity rules
live in ``service.py``. Money is ``Decimal`` — never float (api_contract.md).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.events.models import EventStatus


class EventCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    client_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    venue: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    expected_revenue: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    notes: str | None = None


class EventUpdate(BaseModel):
    """Field updates only. ``status`` is accepted on PATCH for dispatch but is
    never applied via ``EventService.update`` — it routes to ``transition_status``.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    client_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    venue: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    expected_revenue: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    notes: str | None = None
    status: EventStatus | None = None


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    venue: str | None
    city: str | None
    start_datetime: datetime | None
    end_datetime: datetime | None
    expected_revenue: Decimal | None
    status: EventStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

    @field_serializer("expected_revenue")
    def serialize_revenue(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value, "f")


class FinancialReadinessChecks(BaseModel):
    """Individual Settlement → Closed gates (informational; EventService enforces)."""

    outstanding: bool
    unattributed_spend: bool
    pending_transactions: bool


class FinancialReadiness(BaseModel):
    """Read-only financial close readiness for an Event (Phase 10)."""

    ready: bool
    checks: FinancialReadinessChecks
    blocking_reasons: list[str]
