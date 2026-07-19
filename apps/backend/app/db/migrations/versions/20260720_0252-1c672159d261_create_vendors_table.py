"""create_vendors_table

Revision ID: 1c672159d261
Revises: 3d8b49e64329
Create Date: 2026-07-20 02:52:16.300835
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1c672159d261"
down_revision: str | None = "3d8b49e64329"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vendors",
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("gst_number", sa.String(length=32), nullable=True),
        sa.Column("pan_number", sa.String(length=32), nullable=True),
        sa.Column("bank_name", sa.String(length=255), nullable=True),
        sa.Column("account_number", sa.String(length=64), nullable=True),
        sa.Column("ifsc", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vendors")),
    )


def downgrade() -> None:
    op.drop_table("vendors")
