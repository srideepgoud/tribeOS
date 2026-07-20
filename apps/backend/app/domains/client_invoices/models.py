"""Client Invoice ORM model.

Columns follow ``docs/db_schema.md`` (§10 client_invoices). Status values follow
``docs/state_machine.md`` §4 and ADR 0013 (Partially Paid / Paid are
system-derived). No ``archived_at`` — lifecycle ends at Cancelled.
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
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ClientInvoiceStatus(enum.StrEnum):
    """Client Invoice lifecycle (ADR 0013 / state_machine §4)."""

    DRAFT = "Draft"
    ISSUED = "Issued"
    PARTIALLY_PAID = "Partially Paid"
    PAID = "Paid"
    CANCELLED = "Cancelled"


_ClientInvoiceStatusColumn = Enum(
    ClientInvoiceStatus,
    name="client_invoice_status",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)


class ClientInvoice(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, Base):
    __tablename__ = "client_invoices"
    __table_args__ = (
        UniqueConstraint("invoice_number", name="uq_client_invoices_invoice_number"),
        Index("ix_client_invoices_event_id_status", "event_id", "status"),
        Index("ix_client_invoices_client_id_status", "client_id", "status"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", name="fk_client_invoices_event_id_events"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", name="fk_client_invoices_client_id_clients"),
        nullable=False,
        index=True,
    )
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, default=None)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[ClientInvoiceStatus] = mapped_column(
        _ClientInvoiceStatusColumn,
        nullable=False,
        default=ClientInvoiceStatus.DRAFT,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)
