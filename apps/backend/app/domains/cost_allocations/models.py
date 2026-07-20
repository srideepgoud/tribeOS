"""Cost Allocation ORM model.

Columns follow ``docs/db_schema.md`` (§12 cost_allocations) exactly.
Child of Transaction — no soft-delete, no invented audit columns (ADR 0012).
"""

from __future__ import annotations

import enum
import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import UUIDPrimaryKeyMixin


class AttributionState(enum.StrEnum):
    """Derived attribution completeness (ADR 0012). Not a stored column."""

    UNATTRIBUTED = "Unattributed"
    PARTIALLY_ATTRIBUTED = "Partially Attributed"
    FULLY_ATTRIBUTED = "Fully Attributed"


class CostAllocation(UUIDPrimaryKeyMixin, Base):
    """Attribution of Transaction cash to a Cost Item."""

    __tablename__ = "cost_allocations"
    __table_args__ = (
        UniqueConstraint(
            "transaction_id",
            "cost_item_id",
            name="uq_cost_allocations_transaction_id_cost_item_id",
        ),
        CheckConstraint(
            "allocated_amount > 0",
            name="ck_cost_allocations_allocated_amount_positive",
        ),
        Index("ix_cost_allocations_transaction_id", "transaction_id"),
        Index("ix_cost_allocations_cost_item_id", "cost_item_id"),
    )

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id", name="fk_cost_allocations_transaction_id_transactions"),
        nullable=False,
    )
    cost_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cost_items.id", name="fk_cost_allocations_cost_item_id_cost_items"),
        nullable=False,
    )
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
