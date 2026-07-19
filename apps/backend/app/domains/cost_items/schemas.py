"""Pydantic schemas for Cost Items API.

``actual_amount`` is never accepted on write (ADR 0008). ``status`` on PATCH
is for dispatch to ``transition_status`` only.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.cost_items.models import CostItemStatus, ExpenseType


class CostItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID
    category_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    expense_type: ExpenseType
    budget_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    negotiated_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    vendor_required: bool = False
    notes: str | None = None


class CostItemUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    expense_type: ExpenseType | None = None
    budget_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    negotiated_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    vendor_required: bool | None = None
    notes: str | None = None
    status: CostItemStatus | None = None


class CostItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    category_id: uuid.UUID
    title: str
    description: str | None
    expense_type: ExpenseType
    budget_amount: Decimal
    negotiated_amount: Decimal | None
    actual_amount: Decimal | None
    vendor_required: bool
    status: CostItemStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

    @field_serializer("budget_amount", "negotiated_amount", "actual_amount")
    def serialize_money(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value, "f")


class CostItemVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cost_item_id: uuid.UUID
    version_number: int
    budget_amount: Decimal
    negotiated_amount: Decimal | None
    actual_amount: Decimal | None
    change_reason: str | None
    changed_by: uuid.UUID | None
    changed_at: datetime

    @field_serializer("budget_amount", "negotiated_amount", "actual_amount")
    def serialize_money(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value, "f")
