"""Event ORM model.

Columns follow ``docs/db_schema.md`` (table ``events``) exactly — no invented
columns. Status values match ``EventStatus`` / ``docs/state_machine.md``.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class EventStatus(enum.StrEnum):
    """Event lifecycle statuses (docs/db_schema.md, docs/state_machine.md)."""

    DRAFT = "Draft"
    PLANNING = "Planning"
    COMMERCIALS = "Commercials"
    PROCUREMENT = "Procurement"
    EXECUTION = "Execution"
    SETTLEMENT = "Settlement"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"


# Persist enum *values* ("Draft", …) as VARCHAR — portable across SQLite tests and Postgres.
_EventStatusColumn = Enum(
    EventStatus,
    name="event_status",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)


class Event(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, SoftDeleteMixin, Base):
    __tablename__ = "events"
    __table_args__ = (Index("ix_events_created_at", "created_at"),)

    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", name="fk_events_client_id_clients"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    venue: Mapped[str | None] = mapped_column(String(255), default=None)
    city: Mapped[str | None] = mapped_column(String(255), default=None)
    start_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    end_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    expected_revenue: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=None)
    status: Mapped[EventStatus] = mapped_column(
        _EventStatusColumn,
        nullable=False,
        default=EventStatus.DRAFT,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)
