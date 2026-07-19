"""Reusable ORM column mixins for the common audit columns defined in
``docs/db_schema.md`` (``id``, ``created_at``, ``updated_at``, ``created_by``,
``updated_by``, ``archived_at``).

``created_by`` / ``updated_by`` are nullable and intentionally carry **no**
foreign key to ``users`` yet: the Users/auth module is out of scope for this
milestone, so there is no ``users`` table to reference and no authenticated
"current user" to record. The FK will be added when the Users module exists.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class UUIDPrimaryKeyMixin:
    """UUID primary key (never integer PKs — see ``db_schema.md``)."""

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """``created_at`` / ``updated_at`` timestamps (UTC, DB-managed)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AuditUserMixin:
    """``created_by`` / ``updated_by`` — nullable, no FK yet (see module docstring)."""

    created_by: Mapped[uuid.UUID | None] = mapped_column(default=None)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(default=None)


class SoftDeleteMixin:
    """``archived_at`` — soft delete marker (NULL = active)."""

    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
