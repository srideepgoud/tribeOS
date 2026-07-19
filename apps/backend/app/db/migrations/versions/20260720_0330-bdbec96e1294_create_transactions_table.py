"""create_transactions_table

Revision ID: bdbec96e1294
Revises: 518384f54b1b
Create Date: 2026-07-20 03:30:03.856486
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bdbec96e1294"
down_revision: str | None = "518384f54b1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "transactions",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("cost_item_id", sa.Uuid(), nullable=True),
        sa.Column("work_order_id", sa.Uuid(), nullable=True),
        sa.Column("client_invoice_id", sa.Uuid(), nullable=True),
        sa.Column("reverses_transaction_id", sa.Uuid(), nullable=True),
        sa.Column(
            "transaction_type",
            sa.Enum(
                "Vendor Payment",
                "Client Receipt",
                "Internal Expense",
                "Refund",
                "Adjustment",
                "Reversal",
                name="transaction_type",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "payment_method",
            sa.Enum(
                "Bank Transfer",
                "Cash",
                "Cheque",
                "UPI",
                "Card",
                "Other",
                name="payment_method",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("reference_number", sa.String(length=128), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "Pending",
                "Completed",
                "Failed",
                "Reversed",
                name="transaction_status",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("remarks", sa.Text(), nullable=True),
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
            name="fk_transactions_cost_item_id_cost_items",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"], ["events.id"], name="fk_transactions_event_id_events"
        ),
        sa.ForeignKeyConstraint(
            ["reverses_transaction_id"],
            ["transactions.id"],
            name="fk_transactions_reverses_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["vendor_work_orders.id"],
            name="fk_transactions_work_order_id_vendor_work_orders",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transactions")),
    )
    op.create_index(
        op.f("ix_transactions_client_invoice_id"),
        "transactions",
        ["client_invoice_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_cost_item_id"), "transactions", ["cost_item_id"], unique=False
    )
    op.create_index(op.f("ix_transactions_event_id"), "transactions", ["event_id"], unique=False)
    op.create_index(
        "ix_transactions_event_id_status", "transactions", ["event_id", "status"], unique=False
    )
    op.create_index(
        op.f("ix_transactions_reverses_transaction_id"),
        "transactions",
        ["reverses_transaction_id"],
        unique=False,
    )
    op.create_index(op.f("ix_transactions_status"), "transactions", ["status"], unique=False)
    op.create_index(
        op.f("ix_transactions_transaction_type"),
        "transactions",
        ["transaction_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_work_order_id"), "transactions", ["work_order_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_work_order_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_transaction_type"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_status"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_reverses_transaction_id"), table_name="transactions")
    op.drop_index("ix_transactions_event_id_status", table_name="transactions")
    op.drop_index(op.f("ix_transactions_event_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_cost_item_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_client_invoice_id"), table_name="transactions")
    op.drop_table("transactions")
