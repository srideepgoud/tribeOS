"""Operations Dashboard response schemas.

Transport shapes only. Money is ``Decimal`` serialized as fixed-scale strings
(api_contract.md). Financial values come from existing summary services — this
module does not define new formulas.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.domains.events.models import EventStatus


class DashboardOverview(BaseModel):
    active_events: int = 0
    settlement_events: int = 0
    closed_events: int = 0
    ready_to_close: int = 0


class DashboardFinance(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    billed_revenue: Decimal
    cash_received: Decimal
    outstanding: Decimal
    cash_spent: Decimal
    attributed_cost: Decimal
    gross_profit: Decimal

    @field_serializer(
        "billed_revenue",
        "cash_received",
        "outstanding",
        "cash_spent",
        "attributed_cost",
        "gross_profit",
    )
    def serialize_money(self, value: Decimal) -> str:
        return format(value.quantize(Decimal("0.01")), "f")


class DashboardAttention(BaseModel):
    outstanding_events: int = 0
    pending_transactions: int = 0
    unattributed_events: int = 0
    ready_to_close_events: int = 0


class DashboardEventRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: EventStatus
    client_name: str

    billed_revenue: Decimal
    cash_received: Decimal
    outstanding: Decimal
    attributed_cost: Decimal
    gross_profit: Decimal

    financial_ready: bool

    @field_serializer(
        "billed_revenue",
        "cash_received",
        "outstanding",
        "attributed_cost",
        "gross_profit",
    )
    def serialize_money(self, value: Decimal) -> str:
        return format(value.quantize(Decimal("0.01")), "f")


class OperationsDashboard(BaseModel):
    overview: DashboardOverview
    finance: DashboardFinance
    attention: DashboardAttention
    events: list[DashboardEventRow] = Field(default_factory=list)
