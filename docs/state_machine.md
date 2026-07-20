# TribeOS State Machine

**Status:** Approved v1.0

**Purpose:** Defines the lifecycle, valid transitions, permissions, and automatic side effects for every stateful entity in TribeOS.

---

## State Machine Principles

1. Every entity has a finite number of states.
2. Every transition must be explicit.
3. Invalid transitions are rejected.
4. Every transition generates an Audit Log.
5. Some transitions trigger automatic business actions.

---

## 1. Event State Machine

### States

```
Draft
   ↓
Planning
   ↓
Commercials
   ↓
Procurement
   ↓
Execution
   ↓
Settlement
   ↓
Closed

Cancelled  (from Draft, Planning, Commercials, or Procurement)
```

### Transition Diagram

```text
Draft
 │
 ▼
Planning
 │
 ▼
Commercials
 │
 ▼
Procurement
 │
 ▼
Execution
 │
 ▼
Settlement
 │
 ▼
Closed

Draft ─────────────► Cancelled
Planning ─────────► Cancelled
Commercials ──────► Cancelled
Procurement ──────► Cancelled
```

### Allowed Transitions

| From | To |
|------|----|
| Draft | Planning |
| Draft | Cancelled |
| Planning | Commercials |
| Planning | Cancelled |
| Commercials | Procurement |
| Commercials | Cancelled |
| Procurement | Execution |
| Procurement | Cancelled |
| Execution | Settlement |
| Settlement | Closed |

### Forbidden

- Closed → Any
- Cancelled → Any
- Execution → Draft
- Settlement → Planning

### Side Effects

| State | Side Effects |
|-------|--------------|
| Planning | Team assignment allowed |
| Commercials | Cost Categories enabled; Cost Items enabled |
| Procurement | Vendor Work Orders allowed |
| Execution | Transactions allowed; Documents upload allowed; Cost Allocations editable |
| Settlement | Final reconciliation; Profit calculation; Cost Allocations remain editable (financial readiness) |
| Closed | **Financial Close** — Event becomes read-only; Cost Allocations for the Event become immutable |
| Cancelled | Future Work Orders blocked; Future Transactions blocked |

### Settlement → Closed (Financial Close) readiness

Settlement → Closed is rejected (`INVALID_STATE` / conflict per API mapping) unless financial readiness holds per ADR 0012, ADR 0013, and `business_rules.md`:

**Expense (ADR 0012)** — for Vendor Payment, Internal Expense, and net effect of their Reversals:

1. Blocking Pending Transactions are resolved (exact Pending policy owned by Financial Close phase).
2. Every non-reversed Completed Transaction that requires Cost Item attribution is **Fully Attributed** (`Σ allocations = Transaction.amount`).
3. Entering Closed locks Cost Allocations for the Event.

**Revenue (ADR 0013):**

4. Event **Outstanding** must be **0** (every non-Cancelled Client Invoice has computed Outstanding = 0). Gate on Outstanding, not on stored invoice status.

5. Event P&L inputs are then deterministic: **Event Profit = Billed Revenue − Total Attributed Cost**.

Fully Attributed alone does **not** lock allocations. **Financial Close (Event Closed)** is the locking point.

---

## 2. Cost Item State Machine

### States

```
Planned
   ↓
Approved
   ↓
In Progress
   ↓
Completed

Cancelled
```

### Diagram

```text
Planned
   │
   ▼
Approved
   │
   ▼
In Progress
   │
   ▼
Completed

Planned ─────► Cancelled
Approved ────► Cancelled
```

### Rules

| State | Rules |
|-------|-------|
| Planned | Budget editable |
| Approved | Budget locked; Versioning enabled |
| In Progress | Transactions allowed |
| Completed | Read-only |
| Cancelled | No Work Orders; No Transactions |

---

## 3. Vendor Work Order State Machine

### States

```
Draft
   ↓
Approved
   ↓
Issued
   ↓
Partially Paid
   ↓
Completed
   ↓
Closed

Cancelled
```

### Diagram

```text
Draft
 │
 ▼
Approved
 │
 ▼
Issued
 │
 ▼
Partially Paid
 │
 ▼
Completed
 │
 ▼
Closed

Draft ───────► Cancelled
Approved ────► Cancelled
```

### Side Effects

| State | Side Effects |
|-------|--------------|
| Draft | Editable |
| Approved | Locked |
| Issued | Vendor notified |
| Partially Paid | Outstanding balance calculated |
| Completed | Vendor confirms completion |
| Closed | Read-only |
| Cancelled | Financial activity blocked |

---

## 4. Client Invoice State Machine

### States

```
Draft
   ↓
Issued
   ↓
Partially Paid   ← system-derived
   ↓
Paid             ← system-derived

Cancelled
```

### Diagram

```text
Draft
 │
 ▼
Issued
 │
 ▼
Partially Paid   (derived)
 │
 ▼
Paid             (derived)

Draft ───────► Cancelled
Issued ──────► Cancelled   (only if Outstanding = invoice total)
```

### User vs system transitions (ADR 0013)

| Transition | Kind |
|------------|------|
| Create → Draft | User |
| Draft → Issued | User |
| Draft → Cancelled | User |
| Issued → Cancelled | User — only when Outstanding equals invoice total (no Completed non-reversed receipts) |
| Issued ↔ Partially Paid ↔ Paid | **System-derived** from Outstanding after Client Receipt Completes / Reverses |

APIs and UI must **not** expose “Mark Paid” or “Mark Partially Paid.” Those statuses are calculations.

### Derived payment status

```text
Completed Receipts → Outstanding → status among Issued / Partially Paid / Paid
```

| Outstanding (Issued+) | Derived status |
|-----------------------|----------------|
| Equals `total_amount` | Issued |
| `0 < Outstanding < total_amount` | Partially Paid |
| `Outstanding = 0` | Paid |

### Rules

| State | Rules |
|-------|-------|
| Draft | Editable; no Client Receipts |
| Issued | Client Receipt allowed; commercial fields locked; Cancel allowed only if Outstanding = total |
| Partially Paid | Remaining balance calculated; commercial fields locked; Cancel forbidden |
| Paid | Locked; Cancel forbidden |
| Cancelled | Cannot receive payments |

---

## 5. Transaction State Machine

### States

```
Pending
   ↓
Completed

Failed
   ↓
Reversed
```

### Diagram

```text
Pending
 │
 ├────────► Completed
 │
 └────────► Failed

Completed ─────► Reversed
```

### Rules

| State | Rules |
|-------|-------|
| Pending | Awaiting confirmation; cash and attribution may still change per service rules |
| Completed | Cash fields immutable; Cost Allocations remain editable until Event Closed (ADR 0012) |
| Failed | Retry allowed |
| Reversed | Creates opposite ledger entry; Attributed Cost and Cash Spent recalculate from linkage |

### Attribution lifecycle (not a Transaction status)

Derived from Cost Allocations on the Transaction (ADR 0012). There is no `Locked` attribution state.

```text
Unattributed
    ↓
Partially Attributed
    ↓
Fully Attributed
```

| Attribution state | Meaning |
|-------------------|---------|
| Unattributed | No Cost Allocation rows |
| Partially Attributed | Some allocations; sum &lt; Transaction.amount |
| Fully Attributed | Sum equals Transaction.amount; still editable until Event Closed |

Allocation immutability is a side effect of Event **Closed** (Financial Close), not of Fully Attributed.

---

## 6. Change Request State Machine

### States

```
Draft
   ↓
Under Review
   ↓
Approved
   ↓
Implemented

Rejected
```

### Diagram

```text
Draft
 │
 ▼
Under Review
 │
 ├────────► Approved
 │               │
 │               ▼
 │         Implemented
 │
 └────────► Rejected
```

### Side Effects

**Approved** (automatically):

- Create Cost Items OR
- Create Cost Item Versions
- Recalculate profitability
- Audit Log

**Implemented:**

- Locked

**Rejected:**

- No financial impact

---

## 7. Document State Machine

### States

```
Uploaded
   ↓
Archived
```

### Rules

| State | Rules |
|-------|-------|
| Uploaded | Metadata editable; File immutable |
| Archived | Hidden from default views; File retained |

---

## 8. User State Machine

### States

```
Active
   ↓
Inactive
   ↓
Archived
```

### Rules

| State | Rules |
|-------|-------|
| Active | Login allowed |
| Inactive | Login blocked |
| Archived | Cannot own new records; Historical references retained |

---

## Global Transition Rules

### Every Transition Must

- Validate permissions
- Validate business rules
- Generate Audit Log
- Update `updated_at`
- Update `updated_by`

### Every Transition May Trigger

- Notifications
- Dashboard refresh
- Financial recalculation
- Activity timeline update

---

## Invalid Transition Handling

If an invalid transition is requested, return **HTTP 409 Conflict**.

**Example**

```
Event: Closed → Planning   →   Rejected
Reason: "Closed events cannot be reopened."
```

---

## Automatic Background Actions

When an Event enters **Execution**, automatically:

- Enable Transactions
- Enable Expense Tracking

When an Event enters **Settlement**, automatically:

- Freeze Budget
- Calculate Event Profit (Billed Revenue − Attributed Cost; surface Unattributed Spend and Cash Received separately)
- Calculate Variance
- Allow Cost Allocation adjustments (financial readiness work)
- Surface Event Outstanding for Client Invoices

When an Event enters **Closed**, automatically:

- Lock editing
- Lock Cost Allocations for the Event (Financial Close — allocations become immutable)
- Archive dashboards
- Generate Event Summary
- Freeze Event P&L inputs (Billed Revenue and Attributed Cost)

---

## State Ownership Matrix

| Entity | Primary Owner |
|--------|---------------|
| Event | Project Manager |
| Cost Item | Finance |
| Vendor Work Order | Procurement |
| Client Invoice | Finance |
| Transaction | Finance |
| Cost Allocation | Finance |
| Change Request | Project Manager |
| Document | Uploader |
| User | Admin |

---

## State Machine Invariants

These conditions must always hold true:

- Closed Events cannot be edited.
- Cost Allocations on a Closed Event cannot be created, updated, or deleted (Financial Close lock).
- Settlement → Closed requires Event Outstanding = 0 for non-Cancelled Client Invoices (computed fact — ADR 0013).
- Cancelled Work Orders cannot receive payments.
- Paid Invoices cannot be modified.
- Partially Paid and Paid invoice statuses are system-derived from Outstanding; never user-set (ADR 0013).
- Completed Transaction cash fields are immutable; Cost Allocations remain editable until Event Closed.
- Historical versions are immutable.
- Audit Logs are immutable.
- Every status transition creates an Audit Log.
- Every financial transition recalculates derived metrics (Cash Spent, Attributed Cost, Unattributed Spend, Billed Revenue, Cash Received, Outstanding as applicable).

---

## Status

**APPROVED**

This document is the authoritative definition of lifecycle management within TribeOS. Backend services, APIs, and UI workflows must enforce these state transitions without exception.
