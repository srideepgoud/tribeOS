# TribeOS

Internal Enterprise Resource Planning (ERP) platform built for **Tribe**, a Hyderabad-based event management company.

TribeOS replaces spreadsheets, WhatsApp coordination, disconnected documents, and manual financial tracking with a single operational platform. Every event should be executable from start to finish — from client onboarding through profitability and close — entirely inside TribeOS.

---

## Documentation

Read these before contributing (they are authoritative — code must never contradict them):

- [`AI_CONTEXT.md`](./AI_CONTEXT.md) — project mission, standards, and non-negotiable constraints
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system architecture and engineering blueprint
- [`docs/domain_model.md`](./docs/domain_model.md) — business language and entities
- [`docs/db_schema.md`](./docs/db_schema.md) — database schema
- [`docs/business_rules.md`](./docs/business_rules.md) — business validation and invariants
- [`docs/state_machine.md`](./docs/state_machine.md) — entity lifecycles and transitions
- [`docs/folder_structure.md`](./docs/folder_structure.md) — domain-first code organization
- [`docs/api_contract.md`](./docs/api_contract.md) — API response envelope, errors, pagination
- [`docs/design_system.md`](./docs/design_system.md) — UI visual language and component standards
- [`docs/design_tokens.md`](./docs/design_tokens.md) — semantic design tokens (used in code)
- [`docs/dependency_policy.md`](./docs/dependency_policy.md) — approved languages, versions, dependency rules
- [`docs/document_hierarchy.md`](./docs/document_hierarchy.md) — precedence order when documents conflict
- [`docs/adr/`](./docs/adr/) — architecture decision records

Execution plans (not frozen specs): [`docs/milestone_0_plan.md`](./docs/milestone_0_plan.md).

Deployment runbook: [`docs/deployment.md`](./docs/deployment.md).

> These documents are **frozen** as of v1.0 (see `docs/document_hierarchy.md`). Implementation conforms to them; changing them requires an explicit instruction (and an ADR for architectural changes).

AI assistant guidance lives in [`.cursor/rules/`](./.cursor/rules/).

---

## Repository Structure

```
tribeos/
├── apps/
│   ├── backend/          # FastAPI application
│   └── web/              # Next.js application
├── packages/
│   └── ui/               # Shared UI components
├── docs/                 # Authoritative documents + ADRs
├── prompts/              # Reusable AI prompts
├── scripts/              # Dev/ops scripts
├── docker/               # Dockerfiles and container config
└── .github/              # CI/CD workflows
```

---

## Tech Stack

**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod

**Backend:** FastAPI, SQLAlchemy 2.0 Async, Alembic, Pydantic v2

**Database:** PostgreSQL on Supabase · **Storage:** Supabase Storage · **Auth:** JWT + RBAC

**Deployment:** Docker, GitHub Actions

---

## Getting Started

> Setup instructions will be added as the backend and web apps are scaffolded.

TribeOS uses a single **Supabase** project as the primary development database. There is no local PostgreSQL to run.

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in your Supabase values:
   - `DATABASE_URL` — Supabase PostgreSQL connection string
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Apply the schema using Alembic migrations. Never edit the schema through the Supabase dashboard.

---

## Development Workflow

Follow the layered flow — never skip layers:

```
Database → Repository → Service → API → Frontend → Tests
```

Business logic lives only in the Service Layer. Repositories only access data. APIs stay thin. UI stays presentation-focused.

---

## Milestone 0 — Foundation (Definition of Done)

Milestone 0 delivers a production-ready foundation with **no business code**. It is complete only when all of the following pass:

- [ ] Repository builds successfully.
- [ ] Frontend starts successfully.
- [ ] Backend starts successfully.
- [ ] Backend connects to Supabase.
- [ ] Alembic can generate and apply a migration.
- [ ] Health endpoint responds.
- [ ] Logging works.
- [ ] Environment validation works.
- [ ] Linting passes.
- [ ] Formatting passes.
- [ ] Tests pass.
- [ ] CI passes.
- [ ] No business entities, tables, APIs, or UI features exist.
