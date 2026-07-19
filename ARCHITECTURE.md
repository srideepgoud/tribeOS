# ARCHITECTURE.md

# TribeOS System Architecture

**Status:** Approved v1.0

---

## Purpose

This document defines the technical architecture of TribeOS. It describes how the application is structured, how data flows through the system, and where different responsibilities belong.

All engineers and AI coding assistants must follow this architecture.

---

## High-Level Overview

TribeOS is an internal Enterprise Resource Planning (ERP) platform built for Tribe.

**Architecture Style:**

- Modular Monolith
- Domain Driven Design (DDD-lite)
- Layered Architecture
- Feature-Based Organization
- API-First
- Backend-Centric Business Logic

---

## System Architecture

```
                    Browser
                       │
                       ▼
              Next.js Frontend
                       │
                 HTTPS / REST API
                       │
                       ▼
               FastAPI Application
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Routers        Services     Middleware
                       │
                       ▼
                 Repository Layer
                       │
                       ▼
              SQLAlchemy ORM (Async)
                       │
                       ▼
             PostgreSQL (Supabase)
```

**Supporting Services**

- Supabase PostgreSQL (primary development database)
- Supabase Storage
- Authentication
- Logging
- Background Jobs (Future)
- Notification Service (Future)

---

## Repository Structure

```
tribeos/
├── apps/
│   ├── backend/
│   └── web/
├── packages/
│   └── ui/
├── docs/
├── scripts/
├── docker/
└── .github/
```

---

## Backend Architecture

TribeOS uses a **domain-first (vertical feature module)** organization. Each business domain owns its full vertical slice — router, service, repository, model, and schema — so everything related to a domain lives together. This scales far better than layer-first folders as the codebase grows.

```
backend/
└── app/
    ├── api/
    │   ├── routers/          # aggregation / top-level router registration
    │   ├── dependencies/     # shared FastAPI dependencies (auth, db session, current user)
    │   └── errors/           # exception handlers + error response models
    │
    ├── core/
    │   ├── config.py         # Pydantic Settings (env-driven)
    │   ├── logging.py        # logging configuration
    │   └── security.py       # JWT, hashing, auth primitives
    │
    ├── db/
    │   ├── base.py           # declarative base + shared mixins (audit columns)
    │   ├── session.py        # async engine + session factory
    │   └── migrations/       # Alembic migrations
    │
    ├── domains/              # vertical feature modules (domain-first)
    │   ├── clients/
    │   │   ├── model.py
    │   │   ├── repository.py
    │   │   ├── service.py
    │   │   ├── schema.py
    │   │   └── router.py
    │   ├── events/
    │   ├── vendors/
    │   ├── finance/
    │   └── documents/
    │
    ├── shared/               # cross-domain reusable code (types, utils, enums)
    │
    └── main.py
```

Within each domain module, the layering rules still apply strictly:

- `router.py` — thin controller (no SQL, no business logic)
- `service.py` — business logic, orchestration, state transitions
- `repository.py` — data access only (no business logic)
- `model.py` — SQLAlchemy ORM model
- `schema.py` — Pydantic request/response schemas

Layer-first folders (`models/`, `repositories/`, `services/`, `schemas/`) are **not** used globally. The layer boundaries are enforced *inside* each domain module instead.

---

## Layer Responsibilities

### API Layer

**Responsible for:**

- Routing
- Request validation
- Authentication
- Authorization
- Response formatting

**Must NOT contain:**

- SQL
- Business logic
- Complex calculations

---

### Service Layer

**Responsible for:**

- Business rules
- Workflow orchestration
- Financial calculations
- Validation
- State transitions

This is the heart of the application. Almost every business decision belongs here.

---

### Repository Layer

**Responsible for:**

- Database queries
- CRUD
- Joins
- Persistence

Must NOT contain business logic.

---

### Database Layer

Responsible only for persistence.

Never perform business calculations in SQL unless approved for performance.

---

## Frontend Architecture

```
web/
├── app/
├── components/
├── features/
├── hooks/
├── services/
├── types/
├── lib/
└── styles/
```

### Frontend Philosophy

- Pages assemble features.
- Features assemble reusable components.
- Components are presentational whenever possible.
- Business logic remains on the backend.

---

## Request Flow

```
User Click
   ↓
React Component
   ↓
React Query
   ↓
API Service
   ↓
FastAPI Router
   ↓
Service
   ↓
Repository
   ↓
Database
   ↓
Repository
   ↓
Service
   ↓
Router
   ↓
Frontend
```

Never bypass layers.

---

## Authentication

JWT Authentication.

**Future:**

- Refresh Tokens
- Role-Based Access Control (RBAC)

Every API endpoint validates:

- Authentication
- Authorization
- Business Rules

---

## Authorization Model

```
Role
 ↓
Permission
 ↓
Feature
```

**Example**

```
Admin
 ↓
events.create
events.update
finance.approve
vendors.manage
```

Prefer permission-based checks rather than hardcoding role checks.

---

## Database Access Pattern

Never access SQLAlchemy directly from API routes.

**Correct Flow**

```
Router
 ↓
Service
 ↓
Repository
 ↓
Database
```

**Incorrect**

```
Router
 ↓
Database
```

---

## Dependency Injection

FastAPI dependency injection is used for:

- Database Session
- Current User
- Authentication
- Permissions
- Services

Dependencies must remain lightweight.

---

## Validation Strategy

```
Frontend            → Zod
Backend             → Pydantic
Business Validation → Service Layer
Database            → Constraints
```

Validation exists at multiple layers.

---

## File Storage

- Database stores metadata only.
- Binary files stored in Supabase Storage.
- Document entity references storage location.
- Never store files inside PostgreSQL.

---

## Financial Architecture

- Financial records are append-only.
- Transactions never change.
- Reversals create new Transactions.
- Invoices are independent from Transactions.
- Profit is calculated.
- Outstanding balances are calculated.
- Budget history is versioned.

---

## Audit Architecture

Every critical action creates an **Audit Log**.

- Audit Logs are immutable.
- Audit Logs are not application logs.

---

## Logging

| Type | Purpose |
| --- | --- |
| Application Logs | Debugging |
| Audit Logs | Business History |

Keep these completely separate.

---

## Error Handling

- Centralized exception handlers.
- Standard error response.

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

Never expose stack traces.

---

## Configuration

- Environment variables only.
- No secrets in source code.
- Use Pydantic Settings.

**Environment variables (database & Supabase)**

```
DATABASE_URL              # Supabase PostgreSQL connection string
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Database Infrastructure

TribeOS uses a **single Supabase project** as the primary development database from the start of the project. For a solo developer building an internal ERP, this prioritizes development speed.

- Supabase PostgreSQL is the single development database — there is no local PostgreSQL to run.
- Alembic is the authoritative migration tool; every schema change is an Alembic migration.
- Manual schema edits via the Supabase dashboard are prohibited.
- Resetting the development database is acceptable while the schema evolves.
- A separate production Supabase project will be introduced only when the application approaches real production use.

---

## Migrations

Alembic is the single source for schema evolution.

Never manually edit the schema directly — including through the Supabase dashboard. All schema changes go through Alembic migrations.

Every schema change requires:

- Migration
- Review
- Testing

---

## Caching

**Future:** Redis

**Current Version:** No caching until required. Optimize only after measuring.

---

## Background Jobs

Future module. Will include:

- Email
- Notifications
- Scheduled reminders
- Report generation
- Invoice reminders

Not part of MVP.

---

## Notifications

Future abstraction. Possible channels:

- Email
- WhatsApp
- SMS
- In-App

Business logic should never depend directly on notification providers.

---

## API Versioning

All APIs begin with:

```
/api/v1/
```

Future versions:

```
/api/v2/
```

Avoid breaking changes.

---

## Naming Conventions

| Context | Convention |
| --- | --- |
| Python | snake_case |
| TypeScript | camelCase |
| React Components | PascalCase |
| Database Tables | snake_case plural |
| Database Columns | snake_case |
| Enums | PascalCase values |

---

## Design System

**Brand:** TR!BE

**Theme:** Dark

| Token | Value |
| --- | --- |
| Primary Background | `#000000` |
| Primary Accent | `#F04E37` |
| Primary Text | `#FFFFFF` |

**Style**

- Premium
- Minimal
- High Contrast
- Spacious
- Modern
- Event Industry

Avoid generic admin dashboard appearance.

---

## Performance Principles

- Optimize for readability first.
- Avoid premature optimization.
- Prevent N+1 queries.
- Use pagination.
- Use database indexes.
- Use eager loading where appropriate.

---

## Testing Strategy

- Unit Tests
- Repository Tests
- Service Tests
- API Tests
- Integration Tests

Critical financial workflows must always have integration tests.

---

## Future Expansion

Architecture should support the following without major refactoring:

- Multi-tenancy
- Multiple organizations
- Inventory
- HR
- CRM
- Analytics
- Vendor Portal
- Client Portal
- Mobile App

---

## Architectural Principles

1. Business logic lives in Services.
2. Repositories only access data.
3. APIs remain thin.
4. UI remains presentation-focused.
5. Domain documents are the source of truth.
6. Every financial operation is traceable.
7. Every state transition is validated.
8. Every important action generates an Audit Log.
9. Prefer composition over inheritance.
10. Design for maintainability over cleverness.

---

## Project Workflow

```
New Feature
   ↓
Domain Review
   ↓
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
Testing
   ↓
Code Review
   ↓
Merge
```

Never skip layers.

---

## Status

**APPROVED**

This document defines the technical architecture of TribeOS and is the engineering blueprint for all implementation work.
