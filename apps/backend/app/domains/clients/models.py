"""Client ORM model.

Columns follow ``docs/db_schema.md`` (table ``clients``) exactly — no invented
columns, no omitted fields, no future-proofing. Common audit columns come from
shared mixins.
"""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Client(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, SoftDeleteMixin, Base):
    __tablename__ = "clients"

    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gst_number: Mapped[str | None] = mapped_column(String(32), default=None)
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    billing_address: Mapped[str | None] = mapped_column(Text, default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
