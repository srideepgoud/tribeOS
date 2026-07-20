"""create_client_invoices_table_and_transaction_fk

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-20 05:00:00.000000

Creates ``client_invoices`` (ADR 0013 / db_schema §10) and adds the deferred
FK from ``transactions.client_invoice_id`` → ``client_invoices.id``.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "client_invoices",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_number", sa.String(length=64), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("gst_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "Draft",
                "Issued",
                "Partially Paid",
                "Paid",
                "Cancelled",
                name="client_invoice_status",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name="fk_client_invoices_event_id_events",
        ),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["clients.id"],
            name="fk_client_invoices_client_id_clients",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_invoices")),
        sa.UniqueConstraint("invoice_number", name="uq_client_invoices_invoice_number"),
    )
    op.create_index(
        op.f("ix_client_invoices_client_id"),
        "client_invoices",
        ["client_id"],
        unique=False,
    )
    op.create_index(
        "ix_client_invoices_client_id_status",
        "client_invoices",
        ["client_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_client_invoices_event_id"),
        "client_invoices",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        "ix_client_invoices_event_id_status",
        "client_invoices",
        ["event_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_client_invoices_status"),
        "client_invoices",
        ["status"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_transactions_client_invoice_id_client_invoices",
        "transactions",
        "client_invoices",
        ["client_invoice_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_client_invoice_id_client_invoices",
        "transactions",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_client_invoices_status"), table_name="client_invoices")
    op.drop_index("ix_client_invoices_event_id_status", table_name="client_invoices")
    op.drop_index(op.f("ix_client_invoices_event_id"), table_name="client_invoices")
    op.drop_index("ix_client_invoices_client_id_status", table_name="client_invoices")
    op.drop_index(op.f("ix_client_invoices_client_id"), table_name="client_invoices")
    op.drop_table("client_invoices")
