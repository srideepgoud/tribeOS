"""Pydantic schemas for Transactions API.

``status`` on PATCH dispatches to ``transition_status`` only.
Allocation writes use PUT replace set (ADR 0012) — not PATCH per line.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.cost_allocations.schemas import CostAllocationLine
from app.domains.transactions.models import PaymentMethod, TransactionStatus, TransactionType


class TransactionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID
    cost_item_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    client_invoice_id: uuid.UUID | None = None
    transaction_type: TransactionType
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    transaction_date: date
    reference_number: str | None = Field(default=None, max_length=128)
    remarks: str | None = None
    allocations: list[CostAllocationLine] | None = None


class TransactionUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    cost_item_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    payment_method: PaymentMethod | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    transaction_date: date | None = None
    reference_number: str | None = Field(default=None, max_length=128)
    remarks: str | None = None
    status: TransactionStatus | None = None
    allocations: list[CostAllocationLine] | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    cost_item_id: uuid.UUID | None
    work_order_id: uuid.UUID | None
    client_invoice_id: uuid.UUID | None
    reverses_transaction_id: uuid.UUID | None
    transaction_type: TransactionType
    payment_method: PaymentMethod
    amount: Decimal
    transaction_date: date
    reference_number: str | None
    status: TransactionStatus
    remarks: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("amount")
    def serialize_money(self, value: Decimal) -> str:
        return format(value, "f")
