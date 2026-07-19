# ADR 0008: Materialized Financial Values on Cost Items

**Status:** Accepted
**Date:** 2026-07-20
**Related:** `docs/db_schema.md` (§6 cost_items, Derived Values); `docs/business_rules.md` (Cost Item Rules, Financial Rules)

## Context

`docs/db_schema.md` defines `budget_amount`, `negotiated_amount`, and `actual_amount` as columns on `cost_items`. The same document (and `docs/business_rules.md` Financial Rules) states that derived financial values — Profit, Gross Margin, Budget Utilization, Outstanding balances, Total Spend, Cost Variance, Savings — are **never manually stored** and must be calculated.

This creates an apparent tension: `actual_amount` looks like a stored derived value. Without an explicit rule, implementers may either:

- omit `actual_amount` (violates the schema), or
- allow users to edit it freely (violates “Actual Cost is calculated from Transactions unless manually adjusted with approval”).

Phase 4 (Cost Items + Cost Item Versions) needs a settled interpretation before coding.

## Decision

Treat Cost Item money columns as follows:

| Column | Ownership | Who writes it |
|--------|-----------|---------------|
| `budget_amount` | User-managed commercial plan | User (via Cost Item create/update; subject to state-machine lock rules) |
| `negotiated_amount` | Commercial / procurement value | User or system per future procurement rules; commercial changes create a Cost Item Version |
| `actual_amount` | **System-maintained** materialized spend | System only — from completed Transactions (and Cost Allocations when shared). Users never edit it directly via ordinary PATCH. Manual adjustment (when later approval workflows exist) is an explicit approved action that also versions history. |

Until the Transactions module exists:

- `actual_amount` remains `NULL` or `0` (implementation chooses one consistently; prefer `NULL` meaning “not yet computed”).
- The field is read-only on all APIs and UIs.
- No recomputation logic is built in Phase 4.

**Never persisted** (always computed in services / read models):

- Event Profit
- Gross Margin
- Budget Utilization
- Outstanding Client Balance
- Outstanding Vendor Liability
- Total Spend
- Cost Variance (`Budget Amount − Actual Cost`)
- Savings

This reconciles the schema columns with the financial rules **without changing either frozen document**.

## Consequences

- **Positive:** Phase 4 can ship `cost_items.actual_amount` as a column that matches the schema while remaining inert until Transactions exist.
- **Positive:** Later Transaction and Cost Allocation services have a clear write target for spend rollups.
- **Positive:** Variance / profit / margin stay pure calculations — no accidental “cache that drifts” for those metrics.
- **Trade-off:** `actual_amount` is a cached materialization; Transaction completion must keep it consistent (deferred to the finance phase).
- **Trade-off:** Manual actual-cost adjustment remains out of scope until Approvals exist; until then the API must reject client attempts to set `actual_amount`.
