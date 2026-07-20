"""backfill_cost_allocations_from_transactions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-20 04:30:00.000000

Idempotent data migration: for each Completed/Reversed-eligible Phase 7
Transaction that has cost_item_id and no allocation rows yet, insert exactly
one Cost Allocation. Does not recompute actual_amount (application concern).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Idempotent: skip rows that already have any allocation for the transaction.
    op.execute(
        sa.text(
            """
            INSERT INTO cost_allocations (id, transaction_id, cost_item_id, allocated_amount)
            SELECT
                gen_random_uuid(),
                t.id,
                t.cost_item_id,
                ABS(t.amount)
            FROM transactions t
            WHERE t.cost_item_id IS NOT NULL
              AND t.status IN ('Completed', 'Reversed')
              AND t.transaction_type <> 'Reversal'
              AND NOT EXISTS (
                  SELECT 1
                  FROM cost_allocations ca
                  WHERE ca.transaction_id = t.id
              )
            """
        )
    )


def downgrade() -> None:
    # Best-effort: remove allocations that exactly match a single header materialization.
    # Safer to leave rows than delete user-created splits — no-op downgrade.
    pass
