"""Vendor ORM model.

Columns follow ``docs/db_schema.md`` (table ``vendors``) exactly. Vendor is a
global master aggregate (no ``event_id``) — ADR 0009.
"""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Vendor(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, SoftDeleteMixin, Base):
    __tablename__ = "vendors"

    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(255), default=None)
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    gst_number: Mapped[str | None] = mapped_column(String(32), default=None)
    pan_number: Mapped[str | None] = mapped_column(String(32), default=None)
    bank_name: Mapped[str | None] = mapped_column(String(255), default=None)
    account_number: Mapped[str | None] = mapped_column(String(64), default=None)
    ifsc: Mapped[str | None] = mapped_column(String(32), default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
