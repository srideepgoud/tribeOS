"""Pydantic schemas for Vendor Work Orders API.

``work_order_number`` and ``version`` are system-owned. ``status`` on PATCH
dispatches to ``transition_status`` only.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.vendor_work_orders.models import VendorWorkOrderStatus


class VendorWorkOrderCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    cost_item_id: uuid.UUID
    vendor_id: uuid.UUID
    scope: str | None = None
    agreed_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    issue_date: date | None = None
    expected_completion: date | None = None


class VendorWorkOrderUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    vendor_id: uuid.UUID | None = None
    scope: str | None = None
    agreed_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    issue_date: date | None = None
    expected_completion: date | None = None
    status: VendorWorkOrderStatus | None = None


class VendorWorkOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cost_item_id: uuid.UUID
    vendor_id: uuid.UUID
    work_order_number: str
    scope: str | None
    agreed_amount: Decimal
    issue_date: date | None
    expected_completion: date | None
    version: int
    status: VendorWorkOrderStatus
    created_at: datetime
    updated_at: datetime

    @field_serializer("agreed_amount")
    def serialize_money(self, value: Decimal) -> str:
        return format(value, "f")
