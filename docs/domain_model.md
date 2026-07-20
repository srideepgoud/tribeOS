# TribeOS - Domain Model & Business Dictionary

**Status:** Approved v1.0

**Purpose:** Defines the business language, core entities, ownership, responsibilities, and relationships used throughout TribeOS. This document is the authoritative source for business terminology and must be referenced before designing the database, APIs, or UI.

---

## Guiding Principles

1. Every business entity has a single responsibility.
2. Every business entity has a single owner.
3. Every piece of data has a single source of truth.
4. Financial records are immutable whenever legally or operationally required.
5. Soft delete (Archive) is preferred over hard delete.
6. Business terminology defined here must remain consistent across the application.

---

## Core Entities

### 1. User

**Purpose:** An authenticated internal Tribe team member who interacts with the system.

**Owner:** System Administrator

**Responsibilities**

- Login
- Perform operations
- Upload documents
- Approve actions
- Generate audit records

**Lifecycle**

```
Create → Update → Archive
```

Never hard delete.

**Used By**

Every entity references Users through:

- `created_by`
- `updated_by`
- `approved_by`
- `uploaded_by`

---

### 2. Client

**Purpose:** An organization or individual hiring Tribe to execute an event.

**Owner:** Account Management

**Responsibilities**

- Client profile
- Contact persons
- Billing information
- Event history

**Lifecycle**

```
Create → Update → Archive
```

Cannot be archived while active Events exist.

**Relationships**

```
Client
 ↓
Many Events
```

---

### 3. Event

**Purpose:** The central business object around which every operation occurs. Everything inside TribeOS belongs to an Event.

**Owner:** Project Manager

**Responsibilities**

- Planning
- Budget
- Vendors
- Operations
- Documents
- Commercials
- Settlement

**Lifecycle**

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
```

**Relationships**

```
Event
 ↓
Many Cost Categories
 ↓
Many Cost Items
 ↓
Many Client Invoices
 ↓
Many Documents
 ↓
Many Transactions
```

---

### 4. Cost Category

**Purpose:** Logical grouping of Cost Items. Used for budgeting, reporting and profitability.

**Examples:** Production, Operations, Hospitality, Marketing, Administration, Travel, Miscellaneous

**Owner:** Finance

**Relationships**

```
One Event
 ↓
Many Cost Categories

One Cost Category
 ↓
Many Cost Items
```

---

### 5. Cost Item

**Purpose:** The atomic financial unit inside an Event. Every expense belongs to exactly one Cost Item.

**Examples:** Main Stage, LED Wall, Security, Fuel, Hotel, Printing

**Owner:** Commercials / Finance

**Responsibilities**

Stores:

- Planned Budget
- Negotiated Cost
- Actual Cost
- Expense Type
- Status

**Types**

- Vendor Expense
- Internal Expense
- Shared Expense

**Rules**

- May or may not have a Vendor.
- May or may not generate a Vendor Work Order.
- Cannot be deleted after financial activity exists.
- Actual Cost (`actual_amount`) is **Attributed Cost** only — derived from Cost Allocations, not from raw Transaction cash (ADR 0012).

**Relationships**

```
One Event
 ↓
Many Cost Items

One Cost Item
 ↓
Zero or One Vendor
 ↓
Zero or One Vendor Work Order
 ↓
Many Cost Allocations
```

---

### 6. Vendor

**Purpose:** External supplier providing products or services.

**Examples:** Audio, Lighting, Security, Printing, Transportation, Artist Management

**Owner:** Procurement

**Responsibilities**

- Company Profile
- Contacts
- GST
- PAN
- Bank Details
- Categories
- Documents

**Lifecycle**

```
Create → Update → Archive
```

Never hard delete.

**Relationships**

```
One Vendor
 ↓
Many Vendor Work Orders
```

---

### 7. Vendor Work Order

**Purpose:** Internal business object assigning a Cost Item to a Vendor. Represents the commercial agreement. Can generate an external Purchase Order (PO) PDF.

**Owner:** Procurement

**Responsibilities**

- Vendor
- Scope
- Amount
- Dates
- Terms
- Status

**Lifecycle**

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
```

Cancelled allowed before completion.

**Rules**

- Generated only from Vendor-type Cost Items.
- Cannot exceed approved Cost Item value unless explicitly overridden.
- Never hard delete.

**Relationships**

```
One Work Order
 ↓
Many Transactions
```

---

### 8. Client Invoice

**Purpose:** Commercial billing aggregate. A claim against a Client for exactly one Event — what the client owes. Separate from cash movement.

**Owner:** Finance

**Responsibilities**

- Invoice number, issue and due dates
- Amounts (`amount`, `gst_amount`, `total_amount`)
- Status (user actions and system-derived payment progress)
- Notes
- Link to Event and Client

**Lifecycle**

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

User actions: Draft → Issued; Draft|Issued → Cancelled (when allowed). **Partially Paid** and **Paid** are derived from Outstanding after Client Receipts Complete or Reverse — never set manually (ADR 0013).

**Rules**

- Belongs to exactly one Event and one Client (`client_id` must match `Event.client_id`).
- Multiple Client Invoices per Event are allowed.
- An invoice does not span multiple Events (v1).
- `invoice_number` is system-generated, globally unique, and immutable after create.
- Never hard-deleted; never archived. Terminal exit is **Cancelled** where allowed.
- After Issued, commercial fields are locked; Paid invoices cannot be modified.
- Client Receipts are Transactions (`transaction_type = Client Receipt`) linked via `client_invoice_id` — not a separate entity.

**Relationships**

```
One Event
 ↓
Many Client Invoices

One Client Invoice
 ↓
Many Transactions (Client Receipts)
```

---

### 9. Transaction

**Purpose:** Immutable financial ledger. Represents movement of money (cash posting). Does **not** own budget attribution.

**Owner:** Finance

**Responsibilities**

- Cash amount, date, payment method, reference
- Transaction type and status
- Links required for cash context (Event; Vendor Work Order or Client Invoice when type requires)
- Optional header `cost_item_id` as a transitional convenience only — not the source of truth for attribution (ADR 0012)

**Types**

- Vendor Payment
- Client Receipt
- Internal Expense
- Refund
- Adjustment
- Reversal

**Rules**

- Cash fields are immutable after completion.
- Corrections require a reversing transaction.
- Amounts cannot be edited after completion.
- A Completed Transaction may exist without Cost Item attribution.
- Event is required on every Transaction (ADR 0011).
- Client Receipts require a Client Invoice; `event_id` must match the invoice’s Event (ADR 0013).
- Client Receipts do not use Cost Allocations (revenue cash, not cost attribution — ADR 0013).

**Relationships**

```
One Event
 ↓
Many Transactions

One Transaction
 ↓
Many Cost Allocations
 ↓
Optional Vendor Work Order
 ↓
Optional Client Invoice
```

---

### 10. Cost Allocation

**Purpose:** Canonical budget attribution of posted cash to one or more Cost Items. Answers “where did the money belong?”

**Owner:** Finance

**Responsibilities**

- Cost Item assignment
- Allocated amount
- Attribution completeness relative to the parent Transaction

**Rules**

- Belongs to exactly one Transaction (child of Transaction aggregate — ADR 0009 / ADR 0012).
- Never rewrites Transaction cash history.
- Cost Allocations are the sole source of Cost Item attribution.
- Attribution may be deferred after cash posting (Unattributed → Partially Attributed → Fully Attributed).
- Allocations become immutable when the Event reaches **Closed** (Financial Close), not when Fully Attributed.
- Not used for Client Receipt Transactions (ADR 0013).

**Relationships**

```
One Transaction
 ↓
Many Cost Allocations

One Cost Item
 ↓
Many Cost Allocations
```

---

### 11. Document

**Purpose:** Metadata describing a file stored in object storage. Actual binary files are stored in Supabase Storage.

**Owner:** Uploader

**Responsibilities**

Stores:

- File Name
- Storage Path
- MIME Type
- File Size
- Version
- Linked Entity

**Supported Attachments**

- Client
- Event
- Vendor
- Work Order
- Transaction
- Cost Item

**Rules**

- Files are immutable.
- Uploading a replacement creates a new version.

---

### 12. Audit Log

**Purpose:** Immutable record of significant business actions.

**Owner:** System

**Captures**

- Entity
- Entity ID
- Action
- Old Value
- New Value
- Timestamp
- User

**Rules**

- Never editable.
- Never deletable.
- System generated only.

---

## Relationship Overview

```text
User
│
├── Client
│      │
│      └── Event
│             │
│             ├── Cost Category
│             │      │
│             │      └── Cost Item
│             │              │
│             │              ├── Vendor
│             │              │      │
│             │              │      └── Vendor Work Order
│             │              │              │
│             │              │              └── Transaction
│             │              │
│             │              ├── Transaction
│             │              │      │
│             │              │      └── Cost Allocation
│             │              └── Document
│             │
│             ├── Client Invoice
│             │      │
│             │      └── Transaction (Client Receipt)
│             │
│             ├── Document
│             └── Audit Log
```

---

## Single Source of Truth

| Business Data | Owner |
|---------------|-------|
| Client Details | Client |
| Event Details | Event |
| Budget | Cost Item |
| Cost Category | Cost Category |
| Vendor Details | Vendor |
| Commercial Agreement | Vendor Work Order |
| Client Billing | Client Invoice |
| Financial Movement (cash) | Transaction |
| Budget Attribution | Cost Allocation |
| File Metadata | Document |
| Change History | Audit Log |

Derived values such as Event Profit, Margin, Outstanding Balance, Budget Utilization, **Billed Revenue**, **Cash Received**, **Cash Spent**, and **Unattributed Spend** are calculated from these entities and are never manually stored. Cost Item **Actual Cost** is system-maintained Attributed Cost only (ADR 0012). **Billed Revenue** and **Cash Received** are distinct metrics (ADR 0013); do not use ambiguous “Client Revenue.”

---

## Architectural Rules

1. Every screen reads from the underlying domain entities.
2. No business data is duplicated across entities.
3. All calculations are derived from the Single Source of Truth.
4. Business logic belongs in the backend Service Layer.
5. UI components never contain business rules.
6. Financial records are append-only whenever possible.
7. Every significant business change generates an Audit Log.
8. Business terminology defined in this document must remain consistent throughout the project.

---

## Status

**Approved for Phase 1 (Database Design)**
