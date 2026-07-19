# TribeOS Database Schema

**Status:** Approved v1.0
**Database:** PostgreSQL 16+
**ORM:** SQLAlchemy 2.0 (Async)

---

## Database Design Principles

1. UUID primary keys for all business entities.
2. Every mutable table contains: `created_at`, `updated_at`, `created_by`, `updated_by`.
3. Financial records are immutable.
4. Soft delete (`archived_at`) instead of hard delete wherever applicable.
5. Business calculations (Profit, Margin, Outstanding, etc.) are derived, never manually stored.
6. Use foreign keys to enforce referential integrity.
7. Normalize data; never duplicate business information.
8. Every important change generates an Audit Log.

---

## Common Audit Columns

Every mutable table includes:

- `id` (UUID, PK)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `created_by` (UUID FK → users)
- `updated_by` (UUID FK → users)
- `archived_at` (TIMESTAMPTZ, Nullable)

---

## 1. users

**Purpose:** Internal authenticated Tribe users.

**Columns**

- `id` (UUID, PK)
- `full_name`
- `email` (Unique)
- `role`
- `is_active`
- `last_login`

**Relationships**

```
User
 ↓
Creates / Updates all business entities
 ↓
Audit Logs
```

---

## 2. clients

**Purpose:** Customer hiring Tribe.

**Columns**

- `id`
- `company_name`
- `gst_number`
- `phone`
- `email`
- `billing_address`
- `notes`

**Relationships**

```
Client
 ↓
Many Client Contacts
 ↓
Many Events
 ↓
Many Client Invoices
```

---

## 3. client_contacts

**Purpose:** Stores multiple client contacts.

**Columns**

- `id`
- `client_id` (FK)
- `name`
- `designation`
- `phone`
- `email`
- `is_primary`

---

## 4. events

**Purpose:** Central business object.

**Columns**

- `id`
- `client_id` (FK)
- `name`
- `venue`
- `city`
- `start_datetime`
- `end_datetime`
- `expected_revenue`
- `status`
- `notes`

**Status Enum**

- Draft
- Planning
- Commercials
- Procurement
- Execution
- Settlement
- Closed
- Cancelled

**Relationships**

```
Event
 ↓
Many Cost Categories
 ↓
Many Cost Items
 ↓
Many Change Requests
 ↓
Many Transactions
 ↓
Many Documents
 ↓
Many Client Invoices
```

---

## 5. cost_categories

**Purpose:** Logical grouping for budgeting and reporting.

**Examples:** Production, Operations, Hospitality, Administration, Marketing, Travel, Miscellaneous

**Columns**

- `id`
- `event_id` (FK)
- `name`
- `display_order`

**Relationships**

```
Cost Category
 ↓
Many Cost Items
```

---

## 6. cost_items

**Purpose:** Atomic financial unit. Every expense belongs to one Cost Item.

**Columns**

- `id`
- `event_id` (FK)
- `category_id` (FK)
- `title`
- `description`
- `expense_type`
- `budget_amount`
- `negotiated_amount`
- `actual_amount`
- `vendor_required`
- `status`
- `notes`

**Expense Type Enum**

- Vendor
- Internal
- Shared

**Status Enum**

- Planned
- Approved
- In Progress
- Completed
- Cancelled

**Rules**

- Vendor is optional.
- Work Order is optional.
- Cannot be deleted once financial activity exists.

**Relationships**

```
Cost Item
 ↓
Many Cost Item Versions
 ↓
Optional Vendor Work Order
 ↓
Many Transactions
 ↓
Many Cost Allocations
 ↓
Many Documents
```

---

## 7. cost_item_versions

**Purpose:** Preserves complete history of commercial changes. Never overwrite financial planning.

**Columns**

- `id`
- `cost_item_id` (FK)
- `version_number`
- `budget_amount`
- `negotiated_amount`
- `actual_amount`
- `change_reason`
- `changed_by` (FK → users)
- `changed_at`

**Rules**

- Insert only.
- Never update.
- Latest values remain in `cost_items`.
- Historical values remain here.

---

## 8. vendors

**Purpose:** External supplier.

**Columns**

- `id`
- `company_name`
- `contact_name`
- `phone`
- `email`
- `gst_number`
- `pan_number`
- `bank_name`
- `account_number`
- `ifsc`
- `notes`

**Relationships**

```
Vendor
 ↓
Many Vendor Work Orders
```

---

## 9. vendor_work_orders

**Purpose:** Commercial agreement between Tribe and Vendor. Generated from Vendor-type Cost Items.

**Columns**

- `id`
- `cost_item_id` (FK)
- `vendor_id` (FK)
- `work_order_number` (Unique)
- `scope`
- `agreed_amount`
- `issue_date`
- `expected_completion`
- `version`
- `status`

**Status Enum**

- Draft
- Approved
- Issued
- Partially Paid
- Completed
- Closed
- Cancelled

**Rules**

- Cannot exceed approved Cost Item budget unless explicitly overridden.
- Never hard delete.
- This entity represents the internal Vendor Work Order.
- The system may generate a vendor-facing Purchase Order (PO) PDF from this Work Order for communication and documentation purposes.

**Relationships**

```
Vendor Work Order
 ↓
Many Transactions
 ↓
Many Documents
```

---

## 10. client_invoices

**Purpose:** Invoices issued to Clients. Separate from financial transactions.

**Columns**

- `id`
- `event_id` (FK)
- `client_id` (FK)
- `invoice_number` (Unique)
- `invoice_date`
- `due_date`
- `amount`
- `gst_amount`
- `total_amount`
- `status`
- `notes`

**Status Enum**

- Draft
- Issued
- Partially Paid
- Paid
- Cancelled

**Relationships**

```
Client Invoice
 ↓
Many Transactions (Client Receipts)
```

---

## 11. transactions

**Purpose:** Immutable financial ledger. Represents every movement of money.

**Columns**

- `id`
- `event_id` (FK)
- `cost_item_id` (FK, Nullable)
- `work_order_id` (FK, Nullable)
- `client_invoice_id` (FK, Nullable)
- `reverses_transaction_id` (FK → `transactions.id`, Nullable)
- `transaction_type`
- `payment_method`
- `amount`
- `transaction_date`
- `reference_number`
- `status`
- `remarks`

**`reverses_transaction_id`**

- UUID, nullable, self-referencing foreign key to `transactions.id`.
- Stores the original transaction that this transaction reverses.
- Null for normal (non-reversal) transactions.
- Set only when `transaction_type = Reversal`.

**Invariants (`reverses_transaction_id`)**

- Nullable.
- Self-referencing foreign key.
- May only be populated when `transaction_type = Reversal`.
- The original transaction cannot itself be a Reversal (`transaction_type ≠ Reversal`).
- One original transaction may be reversed at most once (enforced in the service layer).

**Transaction Types**

- Vendor Payment
- Client Receipt
- Internal Expense
- Refund
- Adjustment
- Reversal

**Status**

- Pending
- Completed
- Failed
- Reversed

**Rules**

- Immutable.
- Never edit completed transactions.
- Corrections require reversal transactions.

**Relationships**

```
Transaction
 ↓
Many Cost Allocations
 ↓
Many Documents
```

---

## 12. cost_allocations

**Purpose:** Supports shared expenses.

**Example:** One invoice split across multiple Cost Items.

**Columns**

- `id`
- `transaction_id` (FK)
- `cost_item_id` (FK)
- `allocated_amount`

**Rules**

- One transaction can fund multiple Cost Items.

---

## 13. change_requests

**Purpose:** Tracks client scope changes.

**Examples:** Add LED Wall, Remove Stage, Extra Security, Venue Change

**Columns**

- `id`
- `event_id` (FK)
- `request_number` (Unique)
- `title`
- `description`
- `requested_by`
- `requested_date`
- `estimated_cost_impact`
- `estimated_schedule_impact`
- `status`
- `approved_by` (FK → users)
- `approved_at`

**Status**

- Draft
- Under Review
- Approved
- Rejected
- Implemented

**Business Rules**

Approval automatically:

- Creates Cost Items OR
- Creates Cost Item Versions
- Recalculates profitability
- Generates Audit Log

---

## 14. documents

**Purpose:** Metadata only. Actual files stored in Supabase Storage.

**Columns**

- `id`
- `entity_type`
- `entity_id`
- `file_name`
- `storage_path`
- `mime_type`
- `size`
- `version`

**Supported Entity Types**

- Client
- Event
- Cost Item
- Vendor
- Vendor Work Order
- Transaction

**Rules**

- Files immutable.
- New upload creates new version.

---

## 15. audit_logs

**Purpose:** Immutable history of business actions.

**Columns**

- `id`
- `entity_type`
- `entity_id`
- `action`
- `old_value` (JSONB)
- `new_value` (JSONB)
- `performed_by` (FK → users)
- `performed_at`

**Rules**

- System generated.
- Never editable.
- Never deletable.

---

## Lookup Enums

- UserRole
- EventStatus
- ExpenseType
- CostItemStatus
- WorkOrderStatus
- TransactionType
- TransactionStatus
- PaymentMethod
- InvoiceStatus
- ChangeRequestStatus
- DocumentEntityType

---

## Relationship Diagram

```text
User
│
├───────────────┐
│               │
▼               ▼
Client      AuditLog
│
├── ClientContacts
│
├── ClientInvoices
│       │
│       └── Transactions (Client Receipts)
│
└── Events
        │
        ├── CostCategories
        │       │
        │       └── CostItems
        │               │
        │               ├── CostItemVersions
        │               ├── VendorWorkOrders
        │               │       │
        │               │       └── Transactions
        │               │
        │               ├── Transactions
        │               │       │
        │               │       └── CostAllocations
        │               │
        │               └── Documents
        │
        ├── ChangeRequests
        ├── Documents
        └── Transactions

Vendor
│
└── VendorWorkOrders
```

---

## Single Source of Truth

| Business Data | Owner |
|---------------|-------|
| Client Details | Client |
| Event Details | Event |
| Cost Categories | Cost Category |
| Budget & Actual Cost | Cost Item |
| Budget History | Cost Item Version |
| Vendor Details | Vendor |
| Commercial Agreement | Vendor Work Order |
| Client Billing | Client Invoice |
| Financial Ledger | Transaction |
| Shared Expense Allocation | Cost Allocation |
| Scope Changes | Change Request |
| File Metadata | Document |
| Change History | Audit Log |

### Derived Values

The following are **NEVER** manually stored:

- Event Profit
- Gross Margin
- Budget Utilization
- Outstanding Client Balance
- Outstanding Vendor Liability
- Total Spend
- Cost Variance
- Savings

These are calculated from: Events, Cost Items, Transactions, Client Invoices, Cost Allocations.

---

## Soft Delete Policy

**Archive Only**

- Clients
- Vendors
- Events
- Cost Categories
- Cost Items

**Never Delete**

- Transactions
- Cost Item Versions
- Audit Logs

**Conditional**

- Vendor Work Orders (Cancel, never delete after issuance)

---

## Recommended Indexes

**Single Column**

- `client_id`
- `event_id`
- `vendor_id`
- `cost_item_id`
- `work_order_id`
- `transaction_date`
- `status`
- `created_at`

**Composite**

- `(event_id, status)`
- `(vendor_id, status)`
- `(cost_item_id, status)`
- `(entity_type, entity_id)` for documents
- `(entity_type, entity_id)` for audit_logs
- `(client_id, status)` for invoices

---

## Status

**APPROVED**

This document becomes the authoritative database schema for TribeOS v1.0 and should not be modified without an architecture review.
