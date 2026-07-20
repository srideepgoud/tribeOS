"""Pydantic schemas for Cost Allocations (nested under Transaction APIs)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.cost_allocations.models import AttributionState


class CostAllocationLine(BaseModel):
    """One line in a replace-set payload."""

    model_config = ConfigDict(str_strip_whitespace=True)

    cost_item_id: uuid.UUID
    allocated_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class CostAllocationReplace(BaseModel):
    """Full replacement of a Transaction's allocation set (PUT body)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    allocations: list[CostAllocationLine] = Field(default_factory=list)


class CostAllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    transaction_id: uuid.UUID
    cost_item_id: uuid.UUID
    allocated_amount: Decimal

    @field_serializer("allocated_amount")
    def serialize_money(self, value: Decimal) -> str:
        return format(value, "f")


class AttributionSummary(BaseModel):
    """Derived attribution completeness for a Transaction."""

    state: AttributionState
    allocated_total: Decimal
    transaction_amount: Decimal
    unattributed_amount: Decimal

    @field_serializer("allocated_total", "transaction_amount", "unattributed_amount")
    def serialize_money(self, value: Decimal) -> str:
        return format(value, "f")
