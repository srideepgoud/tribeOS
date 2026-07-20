"""create_cost_allocations_table

Revision ID: a1b2c3d4e5f6
Revises: bdbec96e1294
Create Date: 2026-07-20 04:20:00.000000

Schema only — Phase 7 data backfill is a separate migration.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "bdbec96e1294"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cost_allocations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), nullable=False),
        sa.Column("cost_item_id", sa.Uuid(), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
            name="fk_cost_allocations_transaction_id_transactions",
        ),
        sa.ForeignKeyConstraint(
            ["cost_item_id"],
            ["cost_items.id"],
            name="fk_cost_allocations_cost_item_id_cost_items",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cost_allocations")),
        sa.UniqueConstraint(
            "transaction_id",
            "cost_item_id",
            name="uq_cost_allocations_transaction_id_cost_item_id",
        ),
        sa.CheckConstraint(
            "allocated_amount > 0",
            name="ck_cost_allocations_allocated_amount_positive",
        ),
    )
    op.create_index(
        "ix_cost_allocations_transaction_id",
        "cost_allocations",
        ["transaction_id"],
        unique=False,
    )
    op.create_index(
        "ix_cost_allocations_cost_item_id",
        "cost_allocations",
        ["cost_item_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_cost_allocations_cost_item_id", table_name="cost_allocations")
    op.drop_index("ix_cost_allocations_transaction_id", table_name="cost_allocations")
    op.drop_table("cost_allocations")
