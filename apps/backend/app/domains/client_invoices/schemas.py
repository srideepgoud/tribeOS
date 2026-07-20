"""Pydantic schemas for Client Invoices API.

``invoice_number`` is system-owned. Partially Paid / Paid are never accepted as
user-supplied status transitions (ADR 0013).
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.client_invoices.models import ClientInvoiceStatus


class ClientInvoiceUserStatusAction(enum.StrEnum):
    """Status values that may be set via the API (never Partially Paid / Paid)."""

    ISSUED = "Issued"
    CANCELLED = "Cancelled"


class ClientInvoiceCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID
    client_id: uuid.UUID
    invoice_date: date
    due_date: date | None = None
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    gst_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    total_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    notes: str | None = None


class ClientInvoiceUpdate(BaseModel):
    """Field updates and optional user status action. Never Partially Paid / Paid."""

    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    gst_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    total_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    notes: str | None = None
    status: ClientInvoiceUserStatusAction | None = None


class ClientInvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    client_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    due_date: date | None
    amount: Decimal
    gst_amount: Decimal
    total_amount: Decimal
    status: ClientInvoiceStatus
    notes: str | None
    outstanding: Decimal | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("amount", "gst_amount", "total_amount", "outstanding")
    def serialize_money(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value, "f")
