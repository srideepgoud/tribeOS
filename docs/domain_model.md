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
Many Transactions
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

### 8. Transaction

**Purpose:** Immutable financial ledger. Represents movement of money.

**Owner:** Finance

**Types**

- Vendor Payment
- Client Receipt
- Internal Expense
- Refund
- Adjustment
- Reversal

**Rules**

- Transactions are immutable.
- Corrections require a reversing transaction.
- Amounts cannot be edited after completion.

**Relationships**

- Optional Event
- Optional Cost Item
- Optional Vendor Work Order
- Optional Client

---

### 9. Document

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

### 10. Audit Log

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
│             │              └── Document
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
| Financial Movement | Transaction |
| File Metadata | Document |
| Change History | Audit Log |

Derived values such as Profit, Margin, Outstanding Balance and Budget Utilization are calculated from these entities and are never manually stored.

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
