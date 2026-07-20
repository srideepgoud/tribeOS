# ADR 0013: Client Invoice and Receipt Lifecycle

**Status:** Accepted  
**Date:** 2026-07-20  
**Related:** ADR 0008 (materialized financial values); ADR 0009 (aggregate ownership); ADR 0010 (cross-aggregate validation); ADR 0011 (transaction financial immutability); ADR 0012 (financial posting and attribution lifecycle); `docs/domain_model.md`; `docs/db_schema.md` (§10–11); `docs/business_rules.md` (Client Invoice / Transaction / Financial Rules); `docs/state_machine.md` (Client Invoice; Event Settlement / Closed)

## Context

Phase 7–8 established the **expense side** of TribeOS finance:

```text
Vendor
    ↓
Vendor Work Order          ← commercial commitment
    ↓
Transaction (Vendor Payment / Internal Expense)
    ↓
Cost Allocation            ← budget attribution (ADR 0012)
```

The **revenue side** is sketched in Tier 1 (`client_invoices`, Transaction type `Client Receipt`, outstanding formula, invoice state machine) but not implemented. ADR 0011 deferred Client Receipts until Client Invoices (Phase 9). ADR 0012 left receipt attribution out of Phase 8 scope.

Phase 9A documentation review confirmed there is **no dual source-of-truth conflict** comparable to Phase 8’s `cost_item_id` vs Cost Allocations. The architecture is largely present. What remains is to **freeze policies and terminology** so implementation does not invent:

- whether “revenue” means invoices or cash
- whether Partially Paid / Paid are user actions or calculations
- how Financial Close decides unpaid invoices exist
- how Invoice and Transaction services share receipt side effects

This ADR does **not** invent a new foundation document or a second cash ledger. It records the revenue-side lifecycle that mirrors the commercial-vs-cash split already used for vendors.

### Principle

> A Client Invoice records what the client owes. A Client Receipt records cash received. Commercial obligations and cash movements evolve independently but remain linked.

Invoice ≠ cash. Receipt ≠ commercial claim. Corrections to cash use append-only Reversal Transactions (ADR 0011). Invoice payment progress is derived from completed receipts, not rewritten by hand.

### Vocabulary (working definitions for this decision)

These clarify language used below. Prefer these names over ambiguous **Client Revenue**. Tier 1 docs conform as of Phase 9B.

| Term | Meaning in TribeOS |
|------|--------------------|
| **Client Invoice** | Commercial claim against a Client for exactly one Event — what the client owes |
| **Client Receipt** | Cash inflow recorded as a Transaction with `transaction_type = Client Receipt` and required `client_invoice_id` — not a separate entity |
| **Billed Revenue** | Sum of `total_amount` for invoices in **Issued**, **Partially Paid**, or **Paid** (exclude Draft and Cancelled) |
| **Cash Received** | Sum of Completed Client Receipt amounts on the Event, net of completed Reversals |
| **Outstanding (invoice)** | `Invoice.total_amount − Σ(Completed, non-reversed Client Receipts for that invoice)` |
| **Outstanding (Event)** | Sum of per-invoice Outstanding for non-Cancelled invoices on the Event |
| **Event Profit** | `Billed Revenue − Total Attributed Cost` (cash never enters this formula) |
| **Financial Close** | Event reaches **Closed** after Settlement — locks finance per ADR 0012; Phase 9 adds an Outstanding gate |

**Billed Revenue and Cash Received are different facts.** They must not be collapsed into a single “Client Revenue” metric.

---

## Options considered

| Option | Model |
|--------|--------|
| **A** | Separate `client_receipts` table alongside Transactions |
| **B** | Client Receipt = Transaction type with `client_invoice_id` (schema as written) |
| **C** | Merge invoice and cash into one mutable “invoice payment” record |
| **D** | User-driven Partially Paid / Paid transitions independent of receipts |
| **E** | Gate Financial Close on invoice **status** (`!= Paid`) |

### Evaluation

| Capability | A | B | C | D | E |
|------------|---|---|---|---|---|
| Single cash ledger (ADR 0011) | No | Yes | Weak | n/a | n/a |
| Partial payments | Yes | Yes | Weak | Weak | n/a |
| Reversal / append-only corrections | Duplicate path | Yes | No | Weak | n/a |
| Matches existing `db_schema.md` | No | Yes | No | Partial | n/a |
| Status cannot drift from money | Yes if careful | Yes if derived | No | No | Fail-open on bugs |
| Terminology clarity for P&L | Needs names | Needs names | Worst | n/a | n/a |

### Why not A, C, D, E

- **A** invents a second cash model and duplicates ADR 0011 immutability rules.
- **C** merges commercial obligation with cash — the anti-pattern ADR 0012 rejected on the expense side.
- **D** lets UI / operators set Paid while Outstanding remains non-zero (or the reverse).
- **E** trusts display status; a status bug would allow Financial Close with real Outstanding remaining.

**Choose B** for storage, with **derived payment status**, **canonical revenue metrics**, and an **Outstanding-based** Financial Close gate (sections below).

---

## Decision

### 1. What is a Client Invoice?

A Client Invoice is a **commercial aggregate** (ADR 0009): a claim against the Client for **exactly one Event**.

It answers:

> How much does the client owe us?

Schema entity remains `client_invoices` (`docs/db_schema.md` §10): `event_id`, `client_id`, `invoice_number`, `invoice_date`, `due_date`, `amount`, `gst_amount`, `total_amount`, `status`, `notes`.

Rules:

- Belongs to exactly one Event and one Client (`client_id` must match `Event.client_id`).
- Multiple Client Invoices per Event are allowed.
- An invoice does **not** span multiple Events (v1).
- No currency column in schema → INR implicit for v1 (do not invent a currency field in Phase 9).
- `invoice_number` is system-generated, globally unique, immutable after create (same class of rule as Vendor Work Order numbering).
- Never hard-deleted; never archived. Terminal commercial exit is **Cancelled** where allowed.

### 2. What is a Client Receipt?

A Client Receipt is **not** a separate entity. It is a Transaction with:

- `transaction_type = Client Receipt`
- `client_invoice_id` required
- `event_id` required and equal to the invoice’s `event_id`

It answers:

> How much money did we actually receive?

Cash fields follow ADR 0011 (immutable after Completed; corrections via Reversal). Receipt lifecycle is the Transaction lifecycle (`Pending` → `Completed` / `Failed`; `Completed` → `Reversed` via append-only Reversal). There is no separate receipt state machine.

**One invoice → many receipts** (partial payments). For Phase 9 MVP, **one receipt belongs to exactly one invoice** (no split of a single receipt across invoices).

**Cost Allocations do not apply** to Client Receipts. Receipts are revenue cash, not cost attribution (ADR 0012 Phase 8 scope already excluded them). Completing a Client Receipt must not require `cost_item_id` or allocation rows.

### 3. Revenue model (canonical metrics)

Freeze terminology. Do **not** use ambiguous **Client Revenue** in new docs or APIs.

```text
Revenue
  └── Billed Revenue     ← Client Invoices (Issued | Partially Paid | Paid)

Cash
  └── Cash Received      ← Completed Client Receipt Transactions (net of Reversals)

Outstanding (invoice)
  = Invoice.total_amount − Σ(Completed, non-reversed Client Receipts)

Outstanding (Event)
  = Σ Outstanding over non-Cancelled invoices on the Event

Event Profit
  = Billed Revenue − Total Attributed Cost
```

| Metric | Formula | Used for |
|--------|---------|----------|
| **Billed Revenue** | `SUM(total_amount)` where status ∈ {Issued, Partially Paid, Paid} | Event P&L / profitability |
| **Cash Received** | `SUM(Client Receipt.amount)` Completed, net of completed Reversals | Cash-flow reporting only |
| **Outstanding** | Invoice total − completed non-reversed receipts | Collections; Financial Close gate |

**Cash never appears in profitability.** Cash appears only in cash-flow reporting. This mirrors ADR 0012’s separation of Cash Spent from Attributed Cost on the expense side.

Supersedes the ambiguous `Profit = Client Revenue − Total Attributed Cost` wording formerly in `business_rules.md` (rewritten in Phase 9B to **Billed Revenue**).

### 4. Invoice lifecycle — user actions vs derived status

Stored `status` values remain those in `db_schema.md` / `state_machine.md`:

```text
Draft
    ↓
Issued
    ↓
Partially Paid      ← derived
    ↓
Paid                ← derived

Cancelled
```

**User (or explicit API) actions only:**

| Transition | Who |
|------------|-----|
| Create → **Draft** | User |
| **Draft** → **Issued** | User |
| **Draft** → **Cancelled** | User |
| **Issued** → **Cancelled** | User — only if Outstanding equals the invoice total (no Completed non-reversed receipts) |

**System-derived only** (never exposed as “Mark Paid” / “Mark Partially Paid”):

```text
Completed Receipts  →  Outstanding  →  status among Issued / Partially Paid / Paid
```

| Outstanding (Issued+) | Derived status |
|-----------------------|----------------|
| Equals `total_amount` (no completed receipts) | **Issued** |
| `0 < Outstanding < total_amount` | **Partially Paid** |
| `Outstanding = 0` | **Paid** |

A single full payment may move **Issued → Paid** without lingering on Partially Paid — status is computed, not a required path visit.

Recalculate after every Client Receipt **Completes** or is **Reversed**. Draft and Cancelled never auto-transition from receipts. Cancelled invoices cannot receive payments (`business_rules.md`).

### 5. Payment and edit rules

| Rule | Policy |
|------|--------|
| Partial payments | Allowed (many receipts per invoice) |
| Overpayment | **Forbidden** — Completing a receipt that would make Outstanding &lt; 0 → `ConflictError` |
| Edit after Issued | Commercial fields locked (`amount`, `gst_amount`, `total_amount`, `client_id`, `event_id`, `invoice_number`, invoice/due dates). `notes` editable until **Paid** or **Cancelled** |
| Paid | Locked (no field edits) — invariant already in `state_machine.md` |
| Delete | Never hard delete; never archive; use Cancel where allowed |
| Cancel after partial/full payment | **Not allowed** from Partially Paid or Paid. Reverse receipts first; Cancel only from Draft or from Issued with zero Completed non-reversed receipts |
| Cash corrections | Reverse the Client Receipt Transaction; never edit completed cash in place |

### 6. Financial Close gate (Outstanding, not status)

ADR 0012 defined Settlement → Closed gates for cost attribution. Phase 9 adds a **revenue** gate:

> Before Event **Closed**, for every non-Cancelled Client Invoice on the Event: **Outstanding must be 0**.

Gate on the **computed financial fact**, not on stored status:

```text
Settlement → Closed blocked when Event Outstanding > 0
```

Do **not** implement the gate as `status != Paid`. If status and Outstanding ever diverge due to a bug, Outstanding wins — the Event must still refuse to close.

This gate is owned with other Financial Close checks (Pending Transactions, full attribution for required spend — ADR 0012). Exact Pending-transaction policy remains with the Financial Close phase where ADR 0012 deferred it.

### 7. Aggregate ownership and service boundaries

```text
Client Invoice     (commercial aggregate root)
    └── referenced by Transactions (Client Receipts)

Transaction        (cash ledger aggregate root — ADR 0011)
    └── Cost Allocation (expense attribution only — ADR 0012; not used for receipts)
```

| Concern | Owner |
|---------|--------|
| Invoice create / update / Issue / Cancel | `ClientInvoiceService` |
| Outstanding calculation; derived Issued / Partially Paid / Paid | `ClientInvoiceService` |
| Client Receipt create / complete / reverse | `TransactionService` |
| Side effect after receipt Complete / Reverse | `TransactionService` orchestrates; calls into `ClientInvoiceService` (or a helper it owns) to recalculate Outstanding + derived status — invoice service owns that invariant (ADR 0009 / 0010) |
| Cross-aggregate checks (invoice exists; same Event; not Cancelled; no overpayment) | Owning service per ADR 0010 validation order |

**Package layout:** focused domain package `client_invoices` (same pattern as `vendor_work_orders`). `docs/folder_structure.md` may continue to map Client Invoice under the clients family for ownership cohesion; package placement follows ADR 0006.

### 8. Phase scope

| Phase | Scope |
|-------|--------|
| **9A** | Documentation review (complete); this ADR (Accepted) |
| **9B** | Update Tier 1: add Client Invoice to `domain_model.md`; expand Client Invoice rules; replace “Client Revenue” with **Billed Revenue**; clarify derived status and Outstanding-based close gate in `state_machine.md` / `business_rules.md`; align SSOT tables |
| **9C** | Implement `client_invoices` domain; enable Client Receipt on `transactions`; outstanding + derived status; Event revenue metrics; frontend list/detail/create + receipt history |
| **Financial Close** | Enforce Outstanding = 0 (this ADR) together with ADR 0012 attribution gates on Settlement → Closed |

**Explicit non-goals of this ADR:** multi-currency invoices, GST line-item tax engines, multi-event invoices, splitting one receipt across invoices, AR aging workflows, client portal, PDF tax invoice generation beyond future Document attachments.

---

## Consequences

- **Positive:** Completes revenue/expense symmetry without a second cash ledger.
- **Positive:** Removes ambiguous “Client Revenue”; P&L uses **Billed Revenue** only; cash-flow uses **Cash Received**.
- **Positive:** Partially Paid / Paid cannot be clicked into existence — Outstanding is the source of payment progress.
- **Positive:** Financial Close cannot be fooled by a wrong Paid badge; Outstanding &gt; 0 always blocks.
- **Positive:** Receipts reuse Transaction immutability and reversal (ADR 0011); no Cost Allocation complexity on the revenue path.
- **Trade-off:** APIs and UI must never expose “Mark Paid”; status badges are read-only reflections of Outstanding.
- **Trade-off:** Phase 9B renamed Client Revenue → Billed Revenue and added Client Invoice to `domain_model.md` (complete).
- **Trade-off:** Event Closed becomes stricter (unpaid invoices block close) — implement with other Financial Close gates.
- **Follow-on:** Phase 9C implementation may begin after Phase 9B (complete).

## Acceptance

This ADR is **Accepted**. Phase 9B Tier 1 updates are complete. Phase 9C implementation may proceed.
