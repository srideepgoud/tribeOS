# TribeOS Business Rules

**Status:** Approved v1.0

**Purpose:** Defines the business rules governing all entities, workflows, validations, and financial operations in TribeOS.

---

## General Principles

1. Every business action must maintain data integrity.
2. Every financial action must be traceable.
3. Business rules are enforced by the backend only.
4. UI may guide users but must never enforce critical rules by itself.
5. Every important business action creates an Audit Log.

---

## User Rules

- Only authenticated users may access TribeOS.
- Every record has a creator.
- Every update records the modifying user.
- Archived users cannot create or edit records.
- Admin users may archive users but never delete them.

---

## Client Rules

- Client name is mandatory.
- Multiple contacts may belong to one client.
- A client cannot be archived while active events exist.
- Clients are never permanently deleted.

---

## Event Rules

- Every event belongs to exactly one client.
- Every event has one Project Manager.
- Event date overlap validation is not required.
- Closed events become read-only.
- Cancelled events cannot create new Work Orders or Transactions.
- Only Draft events may be permanently archived.

---

## Cost Category Rules

- Categories belong to one event.
- Category names must be unique within an event.
- Categories cannot be deleted while Cost Items exist.

---

## Cost Item Rules

- Every Cost Item belongs to one Event.
- Every Cost Item belongs to one Cost Category.
- Budget Amount must be greater than or equal to zero.
- Actual Cost (`actual_amount`) is **Attributed Cost** — calculated from Cost Allocations on Completed (non-reversed) Transactions unless manually adjusted with approval (ADR 0012).
- Actual Cost is not Cash Spent. Cash Spent is calculated from Completed Transactions independently of attribution.
- Vendor Required determines whether a Vendor Work Order may be created.
- Internal expenses never require a Vendor Work Order.
- Shared expenses use Cost Allocations.
- Cost Items with attributed financial activity cannot be deleted.
- Budget changes create a Cost Item Version.
- Commercial value changes always create an Audit Log.

---

## Cost Item Version Rules

- Versions are append-only.
- Previous versions can never be edited.
- Version numbers are sequential.
- Every version records who made the change and why.
- Latest values remain in Cost Item.

---

## Vendor Rules

- Vendor company name is mandatory.
- Bank details may only be edited by Procurement or Admin.
- Vendors cannot be permanently deleted.
- Vendors with active Work Orders cannot be archived.

---

## Vendor Work Order Rules

- Work Orders are generated only from Vendor-type Cost Items.
- One Cost Item may have at most one active Work Order.
- Work Order amount defaults to Negotiated Cost.
- Increasing the Work Order amount above Negotiated Cost requires explicit override approval.
- Issued Work Orders become immutable except for status changes.
- Cancelled Work Orders remain in history.
- A vendor-facing Purchase Order (PO) PDF may be generated from a Vendor Work Order.

---

## Client Invoice Rules

- Invoice numbers are system-generated, globally unique, and immutable after create (ADR 0013).
- Invoice totals cannot be negative.
- Each invoice belongs to exactly one Event and one Client (`client_id` must match `Event.client_id`).
- Multiple Client Invoices per Event are allowed. An invoice does not span multiple Events (v1).
- Never hard-deleted; never archived. Use **Cancelled** where allowed.
- Cancelled invoices cannot receive payments.
- One invoice may receive multiple Client Receipts (partial payments). For v1, one receipt belongs to exactly one invoice.
- Overpayment is forbidden: Completing a Client Receipt that would make Outstanding &lt; 0 is rejected (`ConflictError`).
- After **Issued**, commercial fields are locked (`amount`, `gst_amount`, `total_amount`, `client_id`, `event_id`, `invoice_number`, invoice/due dates). `notes` may remain editable until **Paid** or **Cancelled**.
- **Paid** invoices cannot be modified.
- **Cancel** is allowed from Draft, or from Issued only when Outstanding equals the invoice total (no Completed non-reversed receipts). Cancel from Partially Paid or Paid is forbidden.
- **Partially Paid** and **Paid** are system-derived from Outstanding after Client Receipts Complete or Reverse — never user-driven transitions (ADR 0013).
- Client Receipt cash corrections use Transaction Reversal only; never edit completed receipt amounts in place.

### Outstanding (invoice)

Calculated only.

```text
Outstanding = Invoice.total_amount − Σ(Completed, non-reversed Client Receipts for that invoice)
```

### Derived payment status (Issued+)

| Outstanding | Derived status |
|-------------|----------------|
| Equals `total_amount` (no completed receipts) | Issued |
| `0 < Outstanding < total_amount` | Partially Paid |
| `Outstanding = 0` | Paid |

Recalculate after every Client Receipt Completes or is Reversed. Draft and Cancelled never auto-transition from receipts.

### Outstanding (Event)

```text
Event Outstanding = Σ Outstanding over non-Cancelled invoices on the Event
```

---

## Transaction Rules

- Cash fields are immutable after completion.
- Editing completed amounts is prohibited.
- Corrections require a Reversal transaction.
- Negative amounts are not allowed except for system-generated reversals.
- Vendor Payments require a Vendor Work Order.
- Client Receipts require a Client Invoice; `event_id` must equal the invoice’s `event_id` (ADR 0013).
- Client Receipts do **not** use Cost Allocations or require `cost_item_id` (revenue cash — ADR 0013).
- A Completed Transaction may exist without Cost Item attribution (expense types).
- Header `cost_item_id` is transitional only; Cost Allocations are the sole attribution source of truth (ADR 0012).
- When a Transaction is Completed with a single `cost_item_id` and no allocation payload, the service SHALL create exactly one Cost Allocation for the full amount (expense Completions only — not Client Receipts).
- Every completed expense transaction updates Cash Spent automatically.
- Every completed Client Receipt updates Cash Received and invoice Outstanding / derived status automatically (ADR 0013).
- Attribution changes update Attributed Cost (`actual_amount`) automatically.
- Every transaction creates an Audit Log.

---

## Cost Allocation Rules

- Allocations must belong to one Transaction.
- Cost Allocations are the sole canonical source of Cost Item attribution.
- Allocations cannot exceed Transaction amount (`Σ allocated_amount ≤ Transaction.amount`).
- Attribution lifecycle (derived):
  - **Unattributed** — no allocation rows (`Σ = 0`)
  - **Partially Attributed** — `0 < Σ < Transaction.amount`
  - **Fully Attributed** — `Σ = Transaction.amount`
- When Fully Attributed, total allocated amount must equal the Transaction amount.
- Fully Attributed does not imply immutable; Finance may adjust allocations until Financial Close.
- Allocations cannot reference archived Cost Items.
- Allocations are created and updated only via the Transaction aggregate (no bypassing `TransactionService`).
- Allocations become immutable when the Event reaches **Closed** (Financial Close).
- Client Receipt Transactions never carry Cost Allocations (ADR 0013).

---

## Cash Spent, Attributed Cost, and Unattributed Spend

These are different expense-side metrics (ADR 0012):

```text
Cash Spent (Event)
  = SUM of Completed Vendor Payment and Internal Expense amounts
    (net of completed Reversals)
  — Client Receipts are not Cash Spent; they are Cash Received (ADR 0013)

Attributed Cost (Cost Item)
  = SUM of Cost Allocation amounts on Completed non-reversed Transactions
  = cost_items.actual_amount

Unattributed Spend (Event)
  = Cash Spent − Attributed Cost (Event rollup)
```

- Budget vs Actual uses **Attributed Cost**.
- Cash-flow expense reporting uses **Cash Spent**.
- Unattributed Spend is excluded from Cost Item actuals but **must remain visible** in Event-level financial reports as Unattributed Spend.
- Dashboards must not imply ₹0 spent when Cash Spent &gt; 0 merely because attribution is pending.

---

## Billed Revenue, Cash Received, and Outstanding

These are different revenue-side metrics (ADR 0013). Do **not** use ambiguous “Client Revenue.”

```text
Billed Revenue (Event)
  = SUM(total_amount) for invoices in Issued | Partially Paid | Paid
    (exclude Draft and Cancelled)

Cash Received (Event)
  = SUM of Completed Client Receipt amounts
    (net of completed Reversals)

Outstanding (invoice)
  = Invoice.total_amount − Σ(Completed, non-reversed Client Receipts)

Outstanding (Event)
  = Σ Outstanding over non-Cancelled invoices on the Event
```

- Event P&L / profitability uses **Billed Revenue**.
- Cash-flow reporting uses **Cash Received**.
- Cash never appears in profitability.

---

## Financial Close Rules (Settlement → Closed)

Financial Close maps to Event **Closed** after **Settlement** (ADR 0012, ADR 0013).

Before Settlement → Closed:

**Expense (ADR 0012)** — for Vendor Payment and Internal Expense (and net effect of their Reversals):

1. Blocking Pending Transactions must be resolved (exact Pending policy owned by Financial Close phase).
2. Every non-reversed Completed Transaction that requires Cost Item attribution must be **Fully Attributed**.
3. Entering Closed locks Cost Allocations for the Event (immutable).

**Revenue (ADR 0013):**

4. Event Outstanding must be **0** (every non-Cancelled Client Invoice has Outstanding = 0). Gate on the **computed Outstanding** fact, not on stored invoice status (`status != Paid` is insufficient).

5. Event profitability is then deterministic: **Event Profit = Billed Revenue − Total Attributed Cost**.

During Settlement, allocations remain editable. Reaching Fully Attributed alone does not lock allocations.

---

## Change Request Rules

- Every Change Request belongs to one Event.
- Approved Change Requests automatically:
  - Create new Cost Items OR
  - Create Cost Item Versions
  - Recalculate Event financials
  - Generate Audit Logs
- Rejected requests cannot modify budgets.
- Implemented requests become read-only.

---

## Document Rules

- Documents store metadata only.
- Files remain immutable.
- Uploading a replacement creates a new version.
- Documents may be attached to:
  - Client
  - Event
  - Cost Item
  - Vendor
  - Vendor Work Order
  - Transaction

---

## Audit Log Rules

- Generated automatically.
- Never editable.
- Never deletable.
- Every financial change is logged.
- Every status transition is logged.
- Every approval is logged.

---

## Financial Rules

### Event Profit

Profit is never stored.

```text
Event Profit = Billed Revenue − Total Attributed Cost
```

Cash Spent, Unattributed Spend, and Cash Received are reported separately and must not be silently omitted (ADR 0012, ADR 0013). Cash never enters the profit formula.

### Outstanding Client Balance

Calculated only (same as invoice / Event Outstanding above).

```text
Outstanding = Invoice Total − Completed non-reversed Client Receipts
```

### Outstanding Vendor Liability

Calculated only.

```text
Outstanding = Work Order Amount − Vendor Payments
```

### Budget Variance

Calculated only.

```text
Variance = Budget Amount − Actual Cost
```

Actual Cost here is Attributed Cost (`actual_amount`), not Cash Spent.

### Margin

Calculated only.

```text
Margin = Event Profit ÷ Billed Revenue
```

---

## Soft Delete Rules

**Archive only:**

- Clients
- Vendors
- Events
- Cost Categories
- Cost Items

**Never archive:**

- Transactions
- Cost Allocations
- Audit Logs
- Cost Item Versions
- Client Invoices (Cancel only — ADR 0013)

---

## Approval Rules

Approval is required when:

- Work Order exceeds negotiated amount.
- Budget increases after approval.
- Manual Actual Cost adjustment.
- Change Request implementation.
- Transaction reversal.

---

## Automatic System Actions

The system automatically:

- Updates Event Cash Spent after every Completed / Reversed expense Transaction (Vendor Payment, Internal Expense).
- Updates Event Cash Received after every Completed / Reversed Client Receipt.
- Updates Cost Item Attributed Cost (`actual_amount`) when Cost Allocations change or when linked Transactions Complete / Reverse.
- Recalculates invoice Outstanding and derived Issued / Partially Paid / Paid status after every Client Receipt Completes or is Reversed.
- Updates Work Order balances after Vendor Payments.
- Creates Cost Item Versions on commercial changes.
- Creates Audit Logs on critical actions.
- On Event Closed: locks Cost Allocations for the Event; freezes Event P&L inputs (Billed Revenue and Attributed Cost).
- Recalculates dashboards in real time (Cash Spent, Attributed Cost, Unattributed Spend, Billed Revenue, Cash Received, Outstanding).

---

## Status

**APPROVED**

This document defines the authoritative business behavior for TribeOS. All backend services, APIs, and UI workflows must comply with these rules.
