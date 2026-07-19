"""Cost Item and Cost Item Version ORM models.

Columns follow ``docs/db_schema.md`` (§6 cost_items, §7 cost_item_versions).
Money semantics: ADR 0008 (materialized financial values).
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ExpenseType(enum.StrEnum):
    """Expense classification (docs/db_schema.md)."""

    VENDOR = "Vendor"
    INTERNAL = "Internal"
    SHARED = "Shared"


class CostItemStatus(enum.StrEnum):
    """Cost Item lifecycle (docs/state_machine.md §2)."""

    PLANNED = "Planned"
    APPROVED = "Approved"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


_ExpenseTypeColumn = Enum(
    ExpenseType,
    name="expense_type",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)

_CostItemStatusColumn = Enum(
    CostItemStatus,
    name="cost_item_status",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)


class CostItem(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, SoftDeleteMixin, Base):
    __tablename__ = "cost_items"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", name="fk_cost_items_event_id_events"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cost_categories.id", name="fk_cost_items_category_id_cost_categories"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    expense_type: Mapped[ExpenseType] = mapped_column(_ExpenseTypeColumn, nullable=False)
    budget_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    negotiated_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    # System-maintained (ADR 0008). Remains NULL until Transactions exist.
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    vendor_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[CostItemStatus] = mapped_column(
        _CostItemStatusColumn,
        nullable=False,
        default=CostItemStatus.PLANNED,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)


class CostItemVersion(UUIDPrimaryKeyMixin, Base):
    """Append-only commercial history. Never updated or soft-deleted."""

    __tablename__ = "cost_item_versions"

    cost_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cost_items.id", name="fk_cost_item_versions_cost_item_id_cost_items"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    budget_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    negotiated_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    change_reason: Mapped[str | None] = mapped_column(Text, default=None)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(default=None)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
