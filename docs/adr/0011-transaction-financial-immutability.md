# ADR 0011: Transaction Financial Immutability & Phase 7 Scope

**Status:** Accepted (partially superseded by ADR 0012)  
**Date:** 2026-07-20  
**Related:** ADR 0008 (materialized financial values); ADR 0009 (aggregate ownership); ADR 0010 (cross-aggregate validation); **ADR 0012** (financial posting and attribution lifecycle); **ADR 0013** (Client Invoice and Receipt lifecycle); `docs/db_schema.md` (§11 transactions, §12 cost_allocations); `docs/business_rules.md` (Transaction Rules); `docs/state_machine.md` (§5 Transaction)

## Context

Finance Foundation begins with Transactions. Documentation review surfaced conflicts around reversal mechanics, `event_id` nullability, Phase 7 type scope, and when `actual_amount` updates. Those decisions must be locked before Phase 7 implementation.

Separately, auditability requires a hard rule: once a Transaction is Completed, its financial impact must not be rewritten in place.

## Decision

### 1. Financial immutability (Completed Transaction)

```text
Completed Transaction
        ↓
Cash financial fields immutable
```

The **only** legal way to change **cash** financial impact is:

```text
Create Reversal
        ↓
Create Replacement Transaction (if a corrected entry is needed)
```

After a Transaction reaches **Completed**, never `PATCH`:

- `amount`
- `transaction_type`
- linked Vendor Work Order (`work_order_id`)
- linked Client Invoice (`client_invoice_id`)
- `event_id`

Header `cost_item_id` after Completion follows ADR 0012 (transitional; attribution lives on Cost Allocations).

**Cost Allocations** after Completion: editable while the Event is not Closed; immutable after Financial Close (Event Closed). This supersedes any reading of this ADR that treated allocations as frozen at Transaction Completion (see Supersession below).

Status transitions that do not rewrite cash fields remain allowed per the state machine (e.g. marking the original **Reversed** as a side effect of creating a Reversal). Non-financial metadata (e.g. `remarks`) may remain editable only while **Pending**, unless a later ADR says otherwise.

Reject illegal post-completion cash patches with `InvalidStateError` (`INVALID_STATE`).

### 2. Reversal model (append-only)

- Corrections create a **new** Transaction with `transaction_type = Reversal`.
- The original Completed Transaction is marked `status = Reversed`.
- Never mutate `amount` (or other cash financial fields) on the original row.
- System-generated reversal amounts may be negative per `docs/business_rules.md`.
- Approvals workflow for reversals remains deferred; Phase 7 may allow reversal with an explicit service path (seam for future Approvals).

**Schema correction:** The `transactions` table includes a nullable self-referencing foreign key (`reverses_transaction_id`) to support the approved append-only reversal model. See `docs/db_schema.md` §11. Service-layer invariants: only Reversal rows set the FK; the original must not itself be a Reversal; an original may be reversed at most once.

### 3. Locked Finance Foundation decisions (Phase 7)

| # | Topic | Locked decision |
|---|--------|-----------------|
| 1 | Cross-aggregate validation | ADR 0010 Accepted — apply its order and error precedence |
| 2 | Reversal | Append-only Reversal transaction + original → `Reversed` (§1–2) |
| 3 | `actual_amount` (Phase 7 interim) | Recalculate on **Completed** and **Reversed** for the linked Cost Item via header `cost_item_id` until Phase 8; **superseded for Phase 8+ by ADR 0012** (Attributed Cost from Cost Allocations) |
| 4 | `event_id` | **Required** on every Transaction (schema wins over domain_model “optional Event”) |
| 5 | Phase 7 transaction types | Implement **Vendor Payment** and **Internal Expense**; defer **Client Receipt** until Client Invoices (**Phase 9 / ADR 0013**); other types (`Refund`, `Adjustment`, `Reversal`) as needed for the reversal path |
| 6 | Cost Allocations | **Out of Phase 7** — Phase 8. Phase 7 uses a single `cost_item_id` per transaction (required for implemented types). Phase 8+ governed by ADR 0012 |

### 4. Phase 7 non-goals

- Cost Allocations entity / split across many Cost Items
- Client Invoice aggregate and Client Receipt flows
- Settlement automation beyond respecting Event status gates
- Approvals workflow UI/engine
- Financial read-model / dashboard APIs (Financial Close / former Phase 10)

### 5. Aggregate note

Transaction is the aggregate root for the ledger entry. Cost Allocation remains a **child** of Transaction (ADR 0009) and is implemented in Phase 8 without independent write APIs that bypass `TransactionService`. Attribution lifecycle and metrics are defined in ADR 0012.

### Superseded by ADR 0012

The following portions are **superseded** by ADR 0012 once Phase 8 attribution is live:

- Treating `actual_amount` as recalculated from Transaction header `cost_item_id` + `Transaction.amount` as the long-term model.
- Freezing Cost Allocations at Transaction **Completed** (allocations lock at Event **Closed** instead).
- Dual-path attribution where header `cost_item_id` remains a permanent source of truth alongside allocations.

**Still in force:** cash immutability after Completed; append-only Reversal; required `event_id`; Phase 7 type scope; aggregate ownership; no independent allocation write APIs.

## Consequences

- **Positive:** Strong audit trail — cash financial history is append-only after completion.
- **Positive:** Phase 7 scope is narrow enough to ship interim actuals maintenance without allocation complexity.
- **Positive:** Resolves documentation conflicts (`event_id`, reversal vs in-place edit) without editing frozen Tier 1 prose — this ADR is the tie-breaker for Phase 7.
- **Trade-off:** Replacement after reversal is a second user/system action, not an in-place edit — slightly more operational steps, much clearer history.
- **Trade-off:** Client Receipts wait for Phase 9 / ADR 0013; Vendor Payment and Internal Expense are enough to exercise VWO linkage and interim Cost Item actuals until ADR 0012 Phase 8.
