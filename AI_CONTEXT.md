# AI_CONTEXT.md

# TribeOS - AI Project Context

**Status:** Approved v1.0

---

## Purpose

This document is the primary context file for all AI coding assistants (Cursor, Claude Code, GitHub Copilot, ChatGPT, etc.) working on TribeOS.

Every AI must read and follow this document before generating, modifying, or reviewing code.

This file defines the project's mission, architecture, design philosophy, coding standards, and non-negotiable constraints.

When conflicts occur, this document takes precedence over assumptions made by the AI.

---

## Project Vision

TribeOS is an internal Enterprise Resource Planning (ERP) platform built exclusively for Tribe, a Hyderabad-based event management company.

- It is not a generic CRM.
- It is not a marketplace.
- It is not a SaaS product (at least for v1).

Its purpose is to replace spreadsheets, WhatsApp conversations, disconnected documents, and manual financial tracking with a single operational platform.

Every event should be executable from start to finish entirely inside TribeOS.

---

## Business Goal

One Event should flow through the following lifecycle:

```
Client
   ↓
Event
   ↓
Commercial Planning
   ↓
Internal Budget
   ↓
Vendor Assignment
   ↓
Vendor Work Orders
   ↓
Execution
   ↓
Payments
   ↓
Settlement
   ↓
Profitability
   ↓
Close Event
```

---

## Product Philosophy

The project follows ERP principles.

- Business correctness is more important than speed.
- Data integrity is more important than convenience.
- Maintainability is more important than shortcuts.
- Code should optimize for long-term readability rather than minimal lines of code.

---

## Source of Truth

The following documents are authoritative:

| Document | Defines |
| --- | --- |
| `docs/domain_model.md` | Business language |
| `docs/db_schema.md` | Database |
| `docs/business_rules.md` | Business validation |
| `docs/state_machine.md` | Lifecycle transitions |

If generated code conflicts with these documents, the documents are correct.

Never invent business logic.

If two documents conflict, follow the document hierarchy defined in `docs/document_hierarchy.md`.

All documents under `docs/`, all ADRs, `AI_CONTEXT.md`, `ARCHITECTURE.md`, `.cursorrules`, and `.cursor/rules/` are considered **frozen** as of v1.0. Do not modify them unless explicitly instructed; implementation must conform to these documents rather than changing them.

---

## Business Language

Use these exact names:

- Client
- Event
- Cost Category
- Cost Item
- Vendor
- Vendor Work Order
- Client Invoice
- Transaction
- Cost Allocation
- Change Request
- Document
- Audit Log

Never rename these entities. Never introduce synonyms.

**Example:**

- ❌ Purchase Order
- ✅ Vendor Work Order

---

## Single Source of Truth

Each business concept belongs to one entity:

| Concept | Entity |
| --- | --- |
| Client Details | Client |
| Budget | Cost Item |
| Commercial Agreement | Vendor Work Order |
| Financial Ledger | Transaction |
| Invoices | Client Invoice |
| Budget History | Cost Item Version |
| Documents | Document |
| History | Audit Log |

Never duplicate data. Never denormalize without architectural approval.

---

## Technology Stack

**Frontend**

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

**Backend**

- FastAPI
- SQLAlchemy 2.0 Async
- Alembic
- Pydantic v2
- PostgreSQL

**Authentication**

- JWT
- Role Based Access Control (RBAC)

**Storage**

- Supabase Storage

**Database**

- PostgreSQL, hosted on Supabase (single development database)

**Deployment**

- Docker
- GitHub Actions

---

## Architecture Principles

- Feature-based architecture.
- Business logic belongs in the Service Layer.
- Repositories access the database.
- APIs are thin.
- React components never contain business logic.
- No direct SQL inside routes.
- No duplicated validation.
- Everything should be testable.

---

## Backend Folder Philosophy

```
API
 ↓
Services
 ↓
Repositories
 ↓
Database
```

Never bypass layers. Never place business logic inside API routes.

---

## Frontend Philosophy

- Pages compose components.
- Components remain reusable.
- Forms use React Hook Form.
- Validation uses Zod.
- Data fetching uses TanStack Query.
- Never call `fetch()` directly inside components.
- Never duplicate state.

---

## Database Philosophy

- Database follows `db_schema.md`.
- Supabase PostgreSQL is the single development database; Alembic is the authoritative migration tool.
- Always use Alembic migrations.
- Never manually edit the schema directly, including through the Supabase dashboard.
- Never use integer primary keys.
- Always use UUID.
- Financial tables are immutable.
- Soft delete instead of hard delete where defined.

---

## Financial Principles

- Transactions are immutable.
- Invoices are separate from payments.
- Profit is calculated.
- Outstanding balances are calculated.
- Budget history is preserved.
- Every financial change generates an Audit Log.
- Never overwrite historical financial data.

---

## State Machine Rules

- Every entity has finite states.
- Transitions must follow `state_machine.md`.
- Reject invalid transitions.
- Return HTTP 409 Conflict when transition is invalid.
- Never silently change state.

---

## API Principles

- RESTful APIs.
- Consistent response format.
- Use HTTP status codes correctly.
- Validation belongs in backend.
- Pagination for list endpoints.
- Filtering and sorting supported.
- Never expose internal implementation details.

---

## Error Handling

- Return structured errors.
- Never return stack traces.

**Example**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE",
    "message": "Closed events cannot be modified."
  }
}
```

---

## Logging

- Every request has a Request ID.
- Errors logged centrally.
- Audit Logs separate from application logs.
- Never log secrets.

---

## Security

- Validate every request.
- Never trust frontend input.
- Parameterized SQL only.
- Sanitize uploads.
- Validate MIME types.
- Role checks belong in backend.

---

## Performance

- Avoid N+1 queries.
- Use eager loading where appropriate.
- Paginate large datasets.
- Index foreign keys.
- Never optimize prematurely.
- Readability first.

---

## Testing Philosophy

- Every Service should be unit testable.
- Critical workflows require integration tests.
- Business Rules must be tested.
- State transitions must be tested.
- Financial calculations must be tested.

---

## Code Quality Rules

- No magic strings.
- No hardcoded IDs.
- No duplicated logic.
- No commented dead code.
- No large functions.
- Prefer composition.
- Prefer explicit code over clever code.

---

## TypeScript Rules

- Strict mode enabled.
- No `any`.
- Prefer interfaces.
- Use enums where appropriate.

---

## Python Rules

- Python 3.12+
- Type hints everywhere.
- Small services.
- Small repositories.
- Small routers.
- PEP8 compliant.

---

## Git Rules

- Small commits.
- Meaningful commit messages.
- One feature per PR.
- Never commit secrets.

---

## UI / UX Design Language

TribeOS follows the official Tribe brand.

| Token | Value |
| --- | --- |
| Primary Background | Black (`#000000`) |
| Primary Accent | Orange / Red-Orange (`#F04E37`) |
| Primary Text | White (`#FFFFFF`) |

**Style**

- Dark theme by default
- Premium event-industry aesthetic
- Minimal
- Bold typography
- Spacious layouts
- Modern dashboard design
- High contrast
- Orange for CTAs and active states
- Avoid generic Bootstrap-style admin interfaces

**Brand Identity**

- Use the official TR!BE wordmark.
- The exclamation mark is part of the logo identity.
- Maintain consistent spacing and branding throughout the application.

---

## AI Instructions

- Always think before generating code.
- Never assume undocumented business logic.
- Ask for clarification if architecture is ambiguous.
- Prefer extending existing architecture over introducing new patterns.
- Never rename entities defined in the domain model.
- Never generate code that violates `business_rules.md`.
- Never generate database tables outside `db_schema.md`.
- Never introduce libraries without justification.
- Always keep the codebase modular and production-ready.

---

## Development Workflow

Before implementing any feature:

1. Read `AI_CONTEXT.md`
2. Read `domain_model.md`
3. Read `db_schema.md`
4. Read `business_rules.md`
5. Read `state_machine.md`

Then:

```
Database
   ↓
Repository
   ↓
Service
   ↓
API
   ↓
Frontend
   ↓
Tests
```

Never skip layers.

---

## Project Success Criteria

A complete event should be managed entirely within TribeOS:

```
Create Client
   ↓
Create Event
   ↓
Build Commercial Plan
   ↓
Manage Budget
   ↓
Assign Vendors
   ↓
Generate Vendor Work Orders
   ↓
Track Documents
   ↓
Record Transactions
   ↓
Issue Client Invoices
   ↓
Execute Event
   ↓
Settlement
   ↓
Profitability
   ↓
Close Event
```

- No spreadsheets.
- No WhatsApp coordination.
- No manual financial reconciliation.
- Everything happens inside TribeOS.

---

END OF FILE
