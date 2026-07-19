# TribeOS Folder Structure

**Status:** Approved v1.0

**Purpose:** Removes ambiguity about *where code belongs*. Every future feature follows this structure. TribeOS uses **domain-first (vertical feature module)** organization on the backend — each domain owns its full vertical slice.

---

## Monorepo Layout

```text
tribeos/
├── apps/
│   ├── backend/          # FastAPI application
│   └── web/              # Next.js application
├── packages/
│   └── ui/               # Shared UI components
├── docs/                 # Authoritative documents + ADRs
├── prompts/              # Reusable AI prompt templates
├── scripts/              # Dev/ops scripts
├── docker/               # Dockerfiles and container config
└── .github/              # CI/CD workflows
```

---

## Backend (`apps/backend`)

Domain-first. Layer boundaries are enforced *inside* each domain module, not via global layer folders.

```text
backend/app/
│
├── api/
│   ├── routers/          # top-level router registration / aggregation
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
├── domains/              # vertical feature modules
│   ├── clients/
│   ├── events/
│   ├── vendors/
│   ├── finance/
│   └── documents/
│
├── shared/               # cross-domain reusable code (enums, types, utils)
│
└── main.py
```

### Domain module shape

Every domain under `domains/` follows the same internal layout:

```text
domains/<domain>/
├── model.py          # SQLAlchemy ORM model(s)
├── repository.py     # data access only — no business logic
├── service.py        # business logic, orchestration, state transitions
├── schema.py         # Pydantic request/response schemas
└── router.py         # thin controller — no SQL, no business logic
```

Larger domains may split files into packages (e.g. `service/`, `repository/`) while keeping the same responsibilities.

### Why domain-first?

- **Cohesion:** everything about Events lives in `domains/events/` — no jumping between `models/`, `services/`, `repositories/`.
- **Scale:** at 150+ files, layer-first folders become painful to navigate; domain-first stays organized.
- **Ownership:** maps cleanly to the ownership matrix in `docs/db_schema.md`.

### Domain ↔ entity mapping

| Domain | Owns |
| --- | --- |
| `clients` | Client, Client Contact, Client Invoice |
| `events` | Event, Cost Category, Cost Item, Cost Item Version, Change Request |
| `vendors` | Vendor, Vendor Work Order |
| `finance` | Transaction, Cost Allocation, financial calculations |
| `documents` | Document |

> Cross-cutting concerns (Users, Audit Log) live in `shared/` or a dedicated module and are referenced by all domains.

---

## Frontend (`apps/web`)

```text
web/
├── app/                  # Next.js App Router routes
├── components/           # reusable presentational components
├── features/             # feature modules (compose components + hooks + services)
├── hooks/                # reusable React hooks
├── services/             # API service abstraction (no fetch() in components)
├── types/                # local TypeScript types (backend owns Pydantic; no shared types package yet)
├── lib/                  # utilities, client config
└── styles/               # global styles, Tailwind config extensions
```

**Rules**

- Pages assemble features; features assemble reusable components.
- No business logic in components; no direct `fetch()` — always go through `services/`.
- Components are presentational whenever possible.

---

## Rules Summary

1. Backend is domain-first; layer rules apply inside each domain module.
2. Never place business logic in `router.py`, models, or repositories — only in `service.py`.
3. Never place SQL in routers.
4. Cross-domain code goes in `shared/`, never duplicated across domains.
5. New entities are added to the domain that owns them (see mapping above), never as a new global layer folder.
6. `packages/` currently contains only `ui/`. Do **not** add a generic `shared` or speculative `types` package. When a genuine shared need appears (JSON contracts, SDK, constants), create a **purpose-specific** package (`packages/config`, `packages/contracts`, `packages/sdk`, `packages/utils`) at that time.
