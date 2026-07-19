"""Vendor Work Order ORM model.

Columns follow ``docs/db_schema.md`` (§9 vendor_work_orders). Status values and
transitions follow Phase 6 locked decisions (not Partially Paid / Closed —
deferred with payments). No ``archived_at`` — lifecycle ends at Cancelled.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, TimestampMixin, UUIDPrimaryKeyMixin


class VendorWorkOrderStatus(enum.StrEnum):
    """VWO lifecycle (Phase 6 locked decisions)."""

    DRAFT = "Draft"
    APPROVED = "Approved"
    ISSUED = "Issued"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


_VendorWorkOrderStatusColumn = Enum(
    VendorWorkOrderStatus,
    name="vendor_work_order_status",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)


class VendorWorkOrder(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, Base):
    __tablename__ = "vendor_work_orders"
    __table_args__ = (
        UniqueConstraint("work_order_number", name="uq_vendor_work_orders_work_order_number"),
        Index("ix_vendor_work_orders_vendor_id_status", "vendor_id", "status"),
        Index("ix_vendor_work_orders_cost_item_id_status", "cost_item_id", "status"),
    )

    cost_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cost_items.id", name="fk_vendor_work_orders_cost_item_id_cost_items"),
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id", name="fk_vendor_work_orders_vendor_id_vendors"),
        nullable=False,
        index=True,
    )
    work_order_number: Mapped[str] = mapped_column(String(64), nullable=False)
    scope: Mapped[str | None] = mapped_column(Text, default=None)
    agreed_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    issue_date: Mapped[date | None] = mapped_column(Date, default=None)
    expected_completion: Mapped[date | None] = mapped_column(Date, default=None)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[VendorWorkOrderStatus] = mapped_column(
        _VendorWorkOrderStatusColumn,
        nullable=False,
        default=VendorWorkOrderStatus.DRAFT,
        index=True,
    )
