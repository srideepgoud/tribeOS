"""Cost Category ORM model.

Columns follow ``docs/db_schema.md`` (table ``cost_categories``) exactly.
Categories belong to one Event (business_rules.md).
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class CostCategory(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, SoftDeleteMixin, Base):
    __tablename__ = "cost_categories"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", name="fk_cost_categories_event_id_events"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
