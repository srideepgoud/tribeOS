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
| Execution | Transactions allowed; Documents upload allowed |
| Settlement | Final reconciliation; Profit calculation |
| Closed | Event becomes read-only |
| Cancelled | Future Work Orders blocked; Future Transactions blocked |

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
Partially Paid
   ↓
Paid

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
Partially Paid
 │
 ▼
Paid

Draft ───────► Cancelled
Issued ──────► Cancelled
```

### Rules

| State | Rules |
|-------|-------|
| Draft | Editable |
| Issued | Client receipt allowed |
| Partially Paid | Remaining balance calculated |
| Paid | Locked |
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
| Pending | Awaiting confirmation |
| Completed | Immutable |
| Failed | Retry allowed |
| Reversed | Creates opposite ledger entry |

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
- Calculate Profit
- Calculate Variance

When an Event enters **Closed**, automatically:

- Lock editing
- Archive dashboards
- Generate Event Summary

---

## State Ownership Matrix

| Entity | Primary Owner |
|--------|---------------|
| Event | Project Manager |
| Cost Item | Finance |
| Vendor Work Order | Procurement |
| Client Invoice | Finance |
| Transaction | Finance |
| Change Request | Project Manager |
| Document | Uploader |
| User | Admin |

---

## State Machine Invariants

These conditions must always hold true:

- Closed Events cannot be edited.
- Cancelled Work Orders cannot receive payments.
- Paid Invoices cannot be modified.
- Completed Transactions are immutable.
- Historical versions are immutable.
- Audit Logs are immutable.
- Every status transition creates an Audit Log.
- Every financial transition recalculates derived metrics.

---

## Status

**APPROVED**

This document is the authoritative definition of lifecycle management within TribeOS. Backend services, APIs, and UI workflows must enforce these state transitions without exception.
