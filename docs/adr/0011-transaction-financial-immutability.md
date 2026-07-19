# ADR 0011: Transaction Financial Immutability & Phase 7 Scope

**Status:** Accepted  
**Date:** 2026-07-20  
**Related:** ADR 0008 (materialized financial values); ADR 0009 (aggregate ownership); ADR 0010 (cross-aggregate validation); `docs/db_schema.md` (§11 transactions, §12 cost_allocations); `docs/business_rules.md` (Transaction Rules); `docs/state_machine.md` (§5 Transaction)

## Context

Finance Foundation begins with Transactions. Documentation review surfaced conflicts around reversal mechanics, `event_id` nullability, Phase 7 type scope, and when `actual_amount` updates. Those decisions must be locked before Phase 7 implementation.

Separately, auditability requires a hard rule: once a Transaction is Completed, its financial impact must not be rewritten in place.

## Decision

### 1. Financial immutability (Completed Transaction)

```text
Completed Transaction
        ↓
Financial fields immutable
```

The **only** legal way to change financial impact is:

```text
Create Reversal
        ↓
Create Replacement Transaction (if a corrected entry is needed)
```

After a Transaction reaches **Completed**, never `PATCH`:

- `amount`
- allocations (when Phase 8 exists)
- `transaction_type`
- linked Cost Item (`cost_item_id`)
- linked Vendor Work Order (`work_order_id`)
- linked Client Invoice (`client_invoice_id`)
- `event_id`

Status transitions that do not rewrite financial fields remain allowed per the state machine (e.g. marking the original **Reversed** as a side effect of creating a Reversal). Non-financial metadata (e.g. `remarks`) may remain editable only while **Pending**, unless a later ADR says otherwise.

Reject illegal post-completion financial patches with `InvalidStateError` (`INVALID_STATE`).

### 2. Reversal model (append-only)

- Corrections create a **new** Transaction with `transaction_type = Reversal`.
- The original Completed Transaction is marked `status = Reversed`.
- Never mutate `amount` (or other financial fields) on the original row.
- System-generated reversal amounts may be negative per `docs/business_rules.md`.
- Approvals workflow for reversals remains deferred; Phase 7 may allow reversal with an explicit service path (seam for future Approvals).

**Schema correction:** The `transactions` table includes a nullable self-referencing foreign key (`reverses_transaction_id`) to support the approved append-only reversal model. See `docs/db_schema.md` §11. Service-layer invariants: only Reversal rows set the FK; the original must not itself be a Reversal; an original may be reversed at most once.

### 3. Locked Finance Foundation decisions (Phase 7)

| # | Topic | Locked decision |
|---|--------|-----------------|
| 1 | Cross-aggregate validation | ADR 0010 Accepted — apply its order and error precedence |
| 2 | Reversal | Append-only Reversal transaction + original → `Reversed` (§1–2) |
| 3 | `actual_amount` | Recalculate on **Completed** and **Reversed** (and when linked reversal completes) for the linked Cost Item(s); system-only write (ADR 0008) |
| 4 | `event_id` | **Required** on every Transaction (schema wins over domain_model “optional Event”) |
| 5 | Phase 7 transaction types | Implement **Vendor Payment** and **Internal Expense**; defer **Client Receipt** until Client Invoices (Phase 9); other types (`Refund`, `Adjustment`, `Reversal`) as needed for the reversal path |
| 6 | Cost Allocations | **Out of Phase 7** — Phase 8. Phase 7 uses a single `cost_item_id` per transaction (required for implemented types) |

### 4. Phase 7 non-goals

- Cost Allocations entity / split across many Cost Items
- Client Invoice aggregate and Client Receipt flows
- Settlement automation beyond respecting Event status gates
- Approvals workflow UI/engine
- Financial read-model / dashboard APIs (Phase 10)

### 5. Aggregate note

Transaction is the aggregate root for the ledger entry. Cost Allocation remains a **child** of Transaction (ADR 0009) and is implemented in Phase 8 without independent write APIs that bypass `TransactionService`.

## Consequences

- **Positive:** Strong audit trail — financial history is append-only after completion.
- **Positive:** Phase 7 scope is narrow enough to ship actuals maintenance without allocation complexity.
- **Positive:** Resolves documentation conflicts (`event_id`, reversal vs in-place edit) without editing frozen Tier 1 prose — this ADR is the tie-breaker.
- **Trade-off:** Replacement after reversal is a second user/system action, not an in-place edit — slightly more operational steps, much clearer history.
- **Trade-off:** Client Receipts wait for Phase 9; Vendor Payment and Internal Expense are enough to exercise VWO linkage and Cost Item actuals.
