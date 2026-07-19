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
- Actual Cost is calculated from Transactions unless manually adjusted with approval.
- Vendor Required determines whether a Vendor Work Order may be created.
- Internal expenses never require a Vendor Work Order.
- Shared expenses use Cost Allocations.
- Cost Items with Transactions cannot be deleted.
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

- Invoice numbers are unique.
- Invoice totals cannot be negative.
- Cancelled invoices cannot receive payments.
- One invoice may receive multiple client receipts.
- Invoice status updates automatically based on payments received.

---

## Transaction Rules

- Transactions are immutable after completion.
- Editing completed amounts is prohibited.
- Corrections require a Reversal transaction.
- Negative amounts are not allowed except for system-generated reversals.
- Vendor Payments require a Vendor Work Order.
- Client Receipts require a Client Invoice.
- Internal Expenses may reference a Cost Item directly.
- Every completed transaction updates financial summaries automatically.
- Every transaction creates an Audit Log.

---

## Cost Allocation Rules

- Allocations must belong to one Transaction.
- Total allocated amount must equal the Transaction amount.
- Allocations cannot exceed Transaction amount.
- Allocations cannot reference archived Cost Items.

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

### Profit

Profit is never stored.

```
Profit = Client Revenue − Total Actual Cost
```

### Outstanding Client Balance

Calculated only.

```
Outstanding = Invoice Total − Client Receipts
```

### Outstanding Vendor Liability

Calculated only.

```
Outstanding = Work Order Amount − Vendor Payments
```

### Budget Variance

Calculated only.

```
Variance = Budget Amount − Actual Cost
```

### Margin

Calculated only.

```
Margin = Profit ÷ Revenue
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
- Audit Logs
- Cost Item Versions

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

- Updates Event profitability after every Transaction.
- Updates invoice balances after every Client Receipt.
- Updates Work Order balances after Vendor Payments.
- Creates Cost Item Versions on commercial changes.
- Creates Audit Logs on critical actions.
- Recalculates dashboards in real time.

---

## Status

**APPROVED**

This document defines the authoritative business behavior for TribeOS. All backend services, APIs, and UI workflows must comply with these rules.
