"""create_vendor_work_orders_table

Revision ID: 518384f54b1b
Revises: 1c672159d261
Create Date: 2026-07-20 03:06:20.009820
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "518384f54b1b"
down_revision: str | None = "1c672159d261"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vendor_work_orders",
        sa.Column("cost_item_id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("work_order_number", sa.String(length=64), nullable=False),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("agreed_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expected_completion", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "Draft",
                "Approved",
                "Issued",
                "In Progress",
                "Completed",
                "Cancelled",
                name="vendor_work_order_status",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["cost_item_id"],
            ["cost_items.id"],
            name="fk_vendor_work_orders_cost_item_id_cost_items",
        ),
        sa.ForeignKeyConstraint(
            ["vendor_id"], ["vendors.id"], name="fk_vendor_work_orders_vendor_id_vendors"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vendor_work_orders")),
        sa.UniqueConstraint("work_order_number", name="uq_vendor_work_orders_work_order_number"),
    )
    op.create_index(
        op.f("ix_vendor_work_orders_cost_item_id"),
        "vendor_work_orders",
        ["cost_item_id"],
        unique=False,
    )
    op.create_index(
        "ix_vendor_work_orders_cost_item_id_status",
        "vendor_work_orders",
        ["cost_item_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_vendor_work_orders_status"), "vendor_work_orders", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_vendor_work_orders_vendor_id"),
        "vendor_work_orders",
        ["vendor_id"],
        unique=False,
    )
    op.create_index(
        "ix_vendor_work_orders_vendor_id_status",
        "vendor_work_orders",
        ["vendor_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_vendor_work_orders_vendor_id_status", table_name="vendor_work_orders")
    op.drop_index(op.f("ix_vendor_work_orders_vendor_id"), table_name="vendor_work_orders")
    op.drop_index(op.f("ix_vendor_work_orders_status"), table_name="vendor_work_orders")
    op.drop_index("ix_vendor_work_orders_cost_item_id_status", table_name="vendor_work_orders")
    op.drop_index(op.f("ix_vendor_work_orders_cost_item_id"), table_name="vendor_work_orders")
    op.drop_table("vendor_work_orders")
