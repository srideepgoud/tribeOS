# ADR 0012: Financial Posting and Attribution Lifecycle

**Status:** Accepted  
**Date:** 2026-07-20  
**Related:** ADR 0008 (materialized financial values); ADR 0009 (aggregate ownership); ADR 0010 (cross-aggregate validation); ADR 0011 (transaction financial immutability); ADR 0013 (Client Invoice and Receipt lifecycle); `docs/domain_model.md`; `docs/db_schema.md` (§11–12); `docs/business_rules.md` (Transaction / Cost Allocation Rules); `docs/state_machine.md` (Event Settlement / Closed; Transaction)

## Context

Phase 7 shipped Transactions as an immutable cash ledger with a single `cost_item_id` per row (ADR 0011). Phase 8 was scoped as Cost Allocations. Documentation review showed a deeper conflict than “add a child table”:

```text
Transaction.cost_item_id          ← attribution path A
Transaction → Cost Allocation(s)  ← attribution path B
```

These are competing sources of truth for “where did the money belong?” Coding Phase 8 without resolving that conflict would force later rewrites of actuals, APIs, reports, and tests.

Real event-agency workflows also show that **cash movement and budget attribution are not always simultaneous**:

| Scenario | Cash timing | Attribution timing |
|----------|-------------|--------------------|
| Vendor advance / booking deposit | Immediate | Often unknown until scope settles |
| Shared vendor invoice | One payment | Split across Cost Items later or at booking |
| Urgent purchase before Cost Items exist | Immediate | After planning catches up |
| Company overhead (rent, internet) | Immediate | May never hit an Event Cost Item |

TribeOS already has Tier 1 docs for entities, rules, and state machines. This ADR does **not** introduce a new foundation document. It records the single missing business decision: **how financial attribution works relative to posting**, and which storage model implements that policy.

### Principle

> A financial transaction should be recorded exactly once, while its commercial meaning and budget attribution may evolve independently without rewriting cash history.

This preserves ADR 0011 immutability while allowing planning and attribution to mature over time.

### Vocabulary (working definitions for this decision)

These clarify language used below; Tier 1 docs remain authoritative until Phase 7.5B updates them.

| Term | Meaning in TribeOS |
|------|--------------------|
| **Commitment** | Commercial promise before cash moves (e.g. Vendor Work Order amount) |
| **Cash posting** | Recording money movement as a Transaction |
| **Cash Spent** | Money that has left (or entered) the bank for an Event — derived from Completed Transactions, independent of attribution |
| **Attribution** | Assigning posted cash (or a portion of it) to one or more Cost Items via Cost Allocation |
| **Attributed Cost** | Posted cash that has been assigned to Cost Items — derived from Cost Allocations on Completed (non-reversed) Transactions |
| **Unattributed Spend** | Completed Transaction cash not yet covered by Cost Allocations (`Transaction.amount − Σ allocations`, floored at zero per transaction) |
| **Actual Cost** | Cost Item budget-vs-actual figure (`cost_items.actual_amount`) — **Attributed Cost only**, not Cash Spent |
| **Financial Close** | Event becomes financially frozen (maps to existing Event **Closed** after **Settlement** reconciliation) |

Entity name remains **Cost Allocation** (frozen terminology). This ADR does not rename it to “Transaction Line.”

**Cash Spent and Attributed Cost are different facts.** They must not be collapsed into a single metric.

---

## Options considered

| Option | Model |
|--------|--------|
| **A** | Direct `Transaction.cost_item_id` only (Phase 7 as-is) |
| **B** | Optional Cost Allocations for shared costs; header `cost_item_id` remains primary for simple cases |
| **C** | Mandatory lines/allocations on every Transaction; header never attributes |
| **D** | Deferred attribution workflow (cash first; attribution later) without an explicit attribution lifecycle |
| **E** | Hybrid lifecycle: cash posting and attribution are separate lifecycles; Cost Allocations are the attribution mechanism |

### Evaluation (operational capabilities)

| Capability | A | B | C | D | E |
|------------|---|---|---|---|---|
| Partial payments | Yes | Yes | Yes | Yes | Yes |
| Shared invoices | No | Yes | Yes | Yes | Yes |
| Unknown attribution at payment | No | Weak | No | Yes | Yes |
| Office / non-event overhead | Weak | Weak | No | Yes | Yes\* |
| Reversals (append-only) | Yes | Yes | Yes | Yes | Yes |
| Reporting simplicity | High | Low (dual path) | High | Medium | Medium |
| Budget accuracy during execution | Weak if forced early | Good when allocated | Forced early | Weak until attributed | Good when rules applied |
| Future GL integration | Weak | Good | Good | Good | Good |
| User simplicity | High | High for simple; ambiguous for shared | Low (always lines) | Medium | Medium |

\*Within TribeOS v1, every Transaction still belongs to an Event (`event_id` required — ADR 0011). Pure company overhead with **no** Event is out of current product scope; Option E still allows an Event-linked payment to remain **unattributed to Cost Items** until policy requires otherwise.

### Why not A–D

- **A** cannot express shared invoices or deferred splits without inventing fake Cost Items.
- **B** keeps dual sources of truth (`cost_item_id` vs allocations) — the failure mode Phase 8 must avoid.
- **C** blocks payment when Cost Items are unknown (advances, urgent buys) and over-constrains users for simple cases if “lines” are always a separate UX burden without a compatibility path.
- **D** has the right timing idea but under-specifies attribution states and Settlement / Financial Close gates; Option E is D with an explicit attribution lifecycle and Event-finance gate.

---

## Decision

**Choose Option E — Hybrid Lifecycle Model.**

Cash posting and budget attribution are **independent concerns** with different lifecycles. Cost Allocations are the **sole canonical source of Cost Item attribution**. Transaction headers record cash movement; they do not permanently own budget attribution.

### 1. What is a Transaction?

A Transaction is an **immutable cash-ledger entry** (ADR 0011):

- Who was paid / who paid
- When
- How much cash moved (`amount`)
- Payment method, reference, remarks
- Status (`Pending` → `Completed` / `Failed`; `Completed` → `Reversed` via append-only Reversal)
- Links needed for cash context (Event required; Vendor Work Order / Client Invoice when type requires)

After **Completed**, cash fields are immutable. Corrections use Reversal + replacement Transaction.

A Completed Transaction **may exist without Cost Item attribution**.

### 2. What is a Cost Allocation?

A Cost Allocation is a **child of Transaction** (ADR 0009) that answers:

> Which Cost Item(s) does this cash belong to, and for how much?

Schema entity remains `cost_allocations` (`transaction_id`, `cost_item_id`, `allocated_amount` per `docs/db_schema.md` §12).

Cost Allocations:

- never rewrite Transaction cash history
- are created/updated only via `TransactionService` (no independent write APIs that bypass the aggregate — ADR 0009 / 0011)
- cannot reference archived Cost Items (`business_rules.md`)

### 3. When is attribution required?

| Moment | Attribution required? |
|--------|------------------------|
| Creating / completing a Transaction | **No** — cash may post unattributed |
| During Event Execution / early Settlement | **No** — partial or deferred attribution allowed; Finance may adjust allocations during Settlement |
| Leaving Settlement → **Closed** (Financial Close) | **Yes** for event spend that must hit Cost Items — see §5 |
| Permanently never attributing a Completed Transaction | Allowed only if product policy later marks that spend as non-Cost-Item (not required for Phase 8 MVP); default expectation for Vendor Payment / Internal Expense is attribution before Event Closed |

**Phase 8 MVP policy (locked):**

- Event-linked Vendor Payments and Internal Expenses **should** be fully attributed before the Event can move Settlement → Closed.
- Client Receipts remain deferred to Client Invoices (ADR 0011 Phase 9) and are out of Phase 8 attribution scope.

### 4. Attribution lifecycle (independent of Transaction status)

```text
Unattributed
    ↓
Partially Attributed
    ↓
Fully Attributed
```

There is **no `Locked` attribution state**. Immutability of allocations is owned by **Financial Close** (§5), not by reaching Fully Attributed.

| State | Meaning | Invariant |
|-------|---------|-----------|
| **Unattributed** | No Cost Allocation rows | `Σ allocations = 0` |
| **Partially Attributed** | Some allocations exist | `0 < Σ allocations < Transaction.amount` |
| **Fully Attributed** | Attribution complete | `Σ allocations = Transaction.amount` |

While the Event is not **Closed**, Finance may move a Transaction between these states (including adjusting allocations after Fully Attributed — e.g. correcting a split during Settlement). Fully Attributed means “sums correctly today,” not “forever immutable.”

**Resolves the Tier 1 conflict** between “must equal” and “cannot exceed” (`business_rules.md`):

- **Partial:** sum may be less than Transaction amount (cannot exceed still holds).
- **Fully Attributed:** sum **must equal** Transaction amount (equality is mandatory at that state).

Rounding / money representation follows `docs/api_contract.md` (numeric string or integer minor units — decided consistently in finance implementation; sum checks use exact decimal arithmetic).

### 5. Event finance lifecycle and locking (existing Event states)

Do not invent a parallel Event status enum in Phase 8. Map finance readiness onto existing Event states (`docs/state_machine.md`):

| Event state | Finance meaning |
|-------------|-----------------|
| Execution | Cash posting allowed; attribution optional; allocations editable |
| Settlement | Reconciliation; budgets freeze; profit/variance work — **financial readiness**; allocations remain editable |
| Closed | **Financial Close** — Event read-only; allocations for the Event become immutable |

**Financial Close owns locking.** Entering Event **Closed** SHALL lock Cost Allocations for that Event’s Transactions (no create / update / delete of allocations except via append-only correction paths: reverse Transaction, then attribute any replacement). Reaching Fully Attributed alone does **not** lock allocations.

**Settlement → Closed gate (policy for 7.5B / Financial Close phase):**

Before Closed, for Transactions in scope (Vendor Payment, Internal Expense, and their Reversals’ net effect):

1. No Pending Transactions that block close (exact Pending policy left to Financial Close phase).
2. Every non-reversed Completed Transaction that requires Cost Item attribution is **Fully Attributed**.
3. As a Closed side effect, Cost Allocations for the Event become immutable.
4. Profitability is then deterministic for Event P&L (Attributed Cost complete; Cash Spent already known from the ledger).

**Revenue-side gate (ADR 0013):** Before Closed, Event **Outstanding** (sum of invoice Outstanding for non-Cancelled Client Invoices) must be **0**. Gate on the computed Outstanding fact, not on stored invoice status. See ADR 0013 §6.

Phase 10 (“Settlement” dashboards) should be interpreted as **Financial Close / readiness reporting** implementing these gates — not a separate vague “settlement module” inventing a fourth money model.

### 6. Two metrics: Cash Spent vs Attributed Cost

Cash outflow and attributed cost must not be merged.

```text
Cash Spent (Event)
  = SUM(Transaction.amount)
    for Completed Transactions on the Event
    net of completed Reversals (append-only linkage)

Attributed Cost (Cost Item)
  = SUM(Cost Allocation.allocated_amount)
    for allocations whose parent Transaction is Completed
    and not superseded by a completed Reversal of that Transaction

Unattributed Spend (Event)
  = Cash Spent − Attributed Cost (at Event rollup)
  = visible remainder of completed cash not yet assigned to Cost Items
```

**`cost_items.actual_amount` stores Attributed Cost only** (system-maintained per ADR 0008):

```text
cost_items.actual_amount = Attributed Cost for that Cost Item
```

It is **not** Cash Spent. A ₹3L vendor advance that is Completed but still Unattributed:

- increases **Cash Spent** immediately
- leaves **`actual_amount` / Budget vs Actual** unchanged until allocated
- appears in event-level reports as **Unattributed Spend** (see §7)

Rules:

- Users never PATCH `actual_amount` (ADR 0008).
- **Do not** compute Attributed Cost from `Transaction.amount` via header `cost_item_id` once this ADR is Accepted and Phase 8 attribution is live.
- Recalculate `actual_amount` when allocations change and when Transactions Complete / Reverse — while the Event is not Closed (after Closed, allocations are immutable).
- Cash Flow / cash dashboards use **Cash Spent**. Budget vs Actual / Cost Item profitability use **Attributed Cost** (`actual_amount`).

This supersedes the Phase 7 interpretation of ADR 0008 / ADR 0011 that treated header `cost_item_id` + `Transaction.amount` as the sole spend rollup into `actual_amount`.

### 7. Reporting policy for Unattributed Spend

Posted money must never disappear from financial visibility.

**Locked reporting rule:**

> Unattributed Spend is **excluded** from Cost Item `actual_amount` (Attributed Cost) but **SHALL remain visible** in Event-level financial reports as **Unattributed Spend**.

Implications:

- Cost Item / Budget dashboards do not pretend unattributed cash is zero spend at the Event level — they show Cash Spent and call out Unattributed Spend separately.
- Event profitability that requires deterministic Cost Item attribution may treat full attribution as a Settlement → Closed precondition (§5); until then, reports MAY show provisional P&L with an explicit Unattributed Spend line rather than failing silently or hiding cash.
- Dashboards MUST NOT imply “₹0 spent” when Cash Spent &gt; 0 merely because attribution is pending.

Exact UI layout is out of scope; the invariant is visibility of Unattributed Spend at Event scope.

### 8. `Transaction.cost_item_id` and mandatory single-allocation materialization

Header `cost_item_id` is **not** the long-term source of truth for attribution.

**Compatibility invariant (mandatory):**

> When a Transaction is Completed and a single `cost_item_id` is supplied and **no** allocation payload exists, `TransactionService` **SHALL** create exactly one Cost Allocation with `cost_item_id` equal to that header value and `allocated_amount` equal to `Transaction.amount`.

This is an aggregate invariant, not optional convenience. Implementations must not Complete such a Transaction without that row.

| Phase | Behavior |
|-------|----------|
| Phase 7 (existing) | Single required `cost_item_id` for implemented types (ADR 0011) — unchanged until Phase 8 ships |
| Phase 8 | Cost Allocations become canonical. The SHALL invariant above applies on Completion when only header `cost_item_id` is provided |
| Phase 8+ | Header `cost_item_id` may remain as a nullable denormalized convenience (e.g. “primary” Cost Item) but **must not** be used for Attributed Cost / `actual_amount`. 7.5B may mark it optional/nullable for multi-allocation or intentionally unattributed Completions |

If Completion intentionally leaves the Transaction **Unattributed**, the client MUST omit both allocation payload and header `cost_item_id` (or an explicit unattributed flag defined in Phase 8 API design) so the SHALL path does not fire.

This avoids dual-path reporting (Option B’s failure mode) while preserving a simple UX for single-Cost-Item payments.

### 9. Reversals and allocations

- Reversing a Transaction does **not** rewrite original allocation rows in place.
- When a Reversal Completes, Cash Spent and Attributed Cost both recalculate from append-only linkage (exclude original; include replacement if any).
- A replacement Transaction (if any) gets its own attribution lifecycle.
- Preferred approach: **recalculate from linkage**, not mutate historical allocation amounts. Whether a Reversal row carries negative allocations is an implementation detail deferred to Phase 8 within this policy.

After Event **Closed**, allocation rows are immutable; cash corrections still use append-only Reversal Transactions (ADR 0011), with Financial Close policy governing whether Closed Events allow new reversals (deferred to Financial Close phase / 7.5B).

### 10. Aggregate ownership (unchanged)

```text
Transaction  (aggregate root — cash ledger)
  └── Cost Allocation  (child — attribution only)
```

Cross-aggregate checks follow ADR 0010. `TransactionService` owns allocation invariants and `actual_amount` (Attributed Cost) updates (via Cost Item repository writes allowed for system-maintained fields — ADR 0008 / 0010).

### 11. Phase scope

| Phase | Scope |
|-------|--------|
| **7.5A** | This ADR (Proposed → Accepted) |
| **7.5B** | Update Tier 1: `domain_model.md`, `db_schema.md`, `business_rules.md`, `state_machine.md`; supersede conflicting slices of ADR 0008 and ADR 0011 for attribution / actuals vs cash metrics |
| **Phase 8** | Cost Allocation persistence, nested write path under Transaction, attribution states, equality/partial invariants, Attributed Cost → `actual_amount`, Cash Spent / Unattributed Spend reporting hooks, SHALL single-allocation materialization |
| **Phase 9** | Client Invoice + Client Receipt — governed by **ADR 0013** (receipts are not Cost-Allocation attributed) |
| **Financial Close (ex–Phase 10 Settlement)** | Settlement → Closed gates (ADR 0012 attribution + ADR 0013 Outstanding = 0), lock allocations on Closed, freeze Event P&L |

**Explicit non-goals of this ADR:** GL chart of accounts, multi-company accounting, Transaction Line rename, company overhead without Event, GST/TDS line items.

---

## Consequences

- **Positive:** Removes dual attribution SoT before Phase 8 code exists.
- **Positive:** Supports advances, shared invoices, and post-payment attribution without rewriting cash history.
- **Positive:** Separates Cash Spent from Attributed Cost so Event cash visibility does not wait on attribution.
- **Positive:** Unattributed Spend remains visible at Event scope — posted money cannot disappear.
- **Positive:** Financial Close (Event Closed) is the immutability boundary for allocations; Settlement can still correct splits.
- **Positive:** Gives Settlement/Closed a clear finance meaning without a new Event status enum in Phase 8.
- **Positive:** Keeps frozen term **Cost Allocation**; no terminology churn.
- **Trade-off:** Dashboards and APIs must expose at least two spend concepts (Cash Spent vs Attributed Cost / `actual_amount`) plus Unattributed Spend.
- **Trade-off:** Phase 8 must migrate tests from “sum Transaction.amount by cost_item_id into actual_amount” to “Attributed Cost from allocations; Cash Spent from Transactions.”
- **Trade-off:** Event Closed gates become stricter; 7.5B must state them explicitly in `state_machine.md` / `business_rules.md`.
- **Follow-on:** Accept this ADR before any Phase 8 implementation. Do not implement Phase 8 against Option A/B dual-path behavior.

## Acceptance

This ADR is **Accepted**. Phase 7.5B updates Tier 1 documents to conform. Phase 8 implementation must not begin until 7.5B is complete.
