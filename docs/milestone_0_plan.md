# Milestone 0 — Implementation Plan

**Status:** Approved (with refinements)
**Type:** Execution plan (not a frozen authoritative spec)

**Goal:** Deliver a production-ready, empty foundation with **zero business code**, conforming to the frozen documents (`folder_structure.md`, `api_contract.md`, `design_tokens.md`, `dependency_policy.md`, ADR-0003/0004).

---

## Approved Decisions

- **Alembic proof-of-migration:** empty baseline revision. **No placeholder tables.** `alembic revision --autogenerate -m "baseline"` produces an empty migration (no models yet); `alembic upgrade head` proves the system works. The first real migration arrives with the `User` model in Milestone 1.
- **Monorepo tooling:** `pnpm` (JS/TS workspace) + `uv` (Python). No changes.
- **Docker Compose:** not used in Milestone 0. Introduced later only if a service (Redis, MinIO, Mailhog, LocalStack) requires it.
- **Dependencies:** install only what Milestone 0 actually exercises (see `dependency_policy.md`). Everything else is deferred to the milestone that first uses it.

---

## Toolchain Versions (pinned)

| Tool | Version | Pinned via |
| --- | --- | --- |
| Python | 3.12 | `.python-version` |
| Node.js | 22 LTS | `.nvmrc` |
| pnpm | 10.x | `package.json` `packageManager` |
| uv | current stable | CI setup step |

---

## Repository Strategy (polyglot monorepo)

- **JS/TS:** `pnpm` workspaces → `apps/web` + `packages/ui`. (No `packages/shared`; `packages/types` deferred until real shared API contracts exist.)
- **Python:** `uv` → `apps/backend` (`pyproject.toml`, `uv.lock`).
- **Orchestration:** root `package.json` scripts + `Makefile`. No Turborepo yet (deferred until build times justify it).

---

## Phase Breakdown & Commits

| Phase | Goal | Commit |
|-------|------|--------|
| 0.1 | Implementation plan (this document, no code) | — |
| 0.2 | Monorepo + tooling | `chore: initialize monorepo and tooling` |
| 0.3 | Backend foundation | `chore: scaffold backend foundation` |
| 0.4 | Frontend foundation | `chore: scaffold frontend foundation` |
| 0.5 | Shared configuration + workspace packages | `chore: add shared config and workspace packages` |
| 0.6 | CI/CD + quality tooling | `chore: configure CI and quality tooling` |
| 0.7 | Verify against Definition of Done | `chore: verify milestone 0 foundation` |

---

## Folders Created

Per `folder_structure.md`, with **empty** `domains/*` (`.gitkeep`):

```
apps/backend/app/{api/{routers,dependencies,errors},core,db/{migrations},domains,shared}/
apps/web/{app,components,features,hooks,services,types,lib,styles}/
packages/ui/src/
```

> **No placeholder business code.** Do not create placeholder routers, services, repositories, models, or frontend pages solely to satisfy the folder structure. Empty directories (with `.gitkeep`) are fine; files like `client_service.py` or `event_repository.py` containing `pass`/`TODO` are not.

---

## Dependencies (Milestone 0 only)

### Backend (`uv`, Python 3.12)

| Package | Why |
|---------|-----|
| `fastapi` | API framework |
| `uvicorn[standard]` | ASGI server |
| `sqlalchemy[asyncio]` | ORM (2.0 async) |
| `asyncpg` | async Postgres driver |
| `alembic` | migrations (sole schema authority) |
| `pydantic` + `pydantic-settings` | schemas + environment validation |
| `structlog` | structured logging (wraps stdlib logging) |
| `pytest`, `pytest-asyncio` | testing (async) |
| `httpx` | ASGI test client for smoke tests |
| `ruff` | lint + format |
| `mypy` | static typing |

**Deferred:** auth libs (`pyjwt`/`passlib`), `supabase` storage client — no auth/storage in M0.

### Frontend (`pnpm`)

| Package | Why |
|---------|-----|
| `next`, `react`, `react-dom` | App Router framework |
| `typescript` | strict TS |
| `tailwindcss`, `postcss`, `autoprefixer` | styling |
| shadcn/ui base (`components.json`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`) | component-library foundation + theme |
| `eslint`, `eslint-config-next`, `prettier` | lint/format |
| `vitest`, `@testing-library/react`, `jsdom` | testing |

**Deferred to first use:** `@tanstack/react-query`, `react-hook-form`, `zod`, `recharts`.

---

## Configuration Files

- **Root:** `package.json` (workspace scripts + `packageManager`), `pnpm-workspace.yaml`, `.editorconfig`, `.nvmrc`, `.pre-commit-config.yaml`, `Makefile`, `.env.example` (present).
- **Backend:** `pyproject.toml` (deps + ruff/mypy/pytest config), `.python-version`, `alembic.ini`, `app/core/config.py`, `app/db/migrations/env.py`.
- **Frontend:** `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts` (colors/radius/font mapped from `design_tokens.md`), `postcss.config.mjs`, `.eslintrc.json`, `.prettierrc`, `vitest.config.ts`, `components.json`, `app/globals.css` (`:root` CSS variables from `design_tokens.md`).
- **Packages:** each `packages/*` gets `package.json` + `tsconfig.json`.

---

## Key Technical Decisions

### Backend ↔ Supabase
`app/db/session.py` builds an async engine from `settings.DATABASE_URL` (`postgresql+asyncpg://…@db.<ref>.supabase.co:5432/postgres`) with an async `sessionmaker`. To stay PgBouncer/pooler-safe, prepared-statement caching is disabled (`connect_args={"statement_cache_size": 0}`). Migrations use the same URL.

### Alembic
Async `env.py`; `target_metadata` from `app/db/base.py`; `script_location = app/db/migrations`; URL sourced from `settings` (never hardcoded in `alembic.ini`). Baseline revision is **empty** (no models).

### Secrets
`.env` (gitignored) → `pydantic-settings`. Never in code. CI uses GitHub Actions secrets. `.env.example` documents required vars.

### Logging
Configure the **standard library** logger first, then wrap it with **structlog** to emit JSON. This keeps Uvicorn / SQLAlchemy / Alembic logs compatible while producing structured output. A request-ID middleware attaches a Request ID to every request (per `AI_CONTEXT.md`). Application logs only; Audit Logs are a deferred business concern.

### Environment validation
`Settings` declares required fields (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); the app **fails fast** at startup if any are missing/invalid.

### Health checks (infrastructure endpoints)
Outside versioned business routes (see `api_contract.md` exception):
- `GET /health` — liveness → `{"status": "ok"}`
- `GET /health/database` — runs `SELECT 1` to verify Supabase connectivity.

### CI pipeline (GitHub Actions, on push/PR)
- **backend:** `uv sync` → `ruff check` → `ruff format --check` → `mypy` → `pytest`.
- **frontend:** `pnpm install` → `eslint` → `tsc --noEmit` → `vitest run` → `next build`.
- **architecture:** a lightweight enforcement step (script or checklist) that fails the build on architecture violations (see below).

### Architecture enforcement (CI)

Lightweight checks (scripts, not heavy tooling) to keep the architecture honest as the codebase grows:

- ✓ No business logic outside `domains/*`.
- ✓ No raw SQL outside repositories.
- ✓ No API routers importing repositories directly.
- ✓ No frontend `fetch()` outside `services/`.
- ✓ No hardcoded colors outside `design_tokens`.

In Milestone 0 these mostly assert *absence* (no domains code yet); the script scaffolding is put in place so the rules are enforced from the first feature onward.

### Pre-commit hooks
`pre-commit` framework: `ruff` (lint+format) + `trailing-whitespace` / `end-of-file-fixer` for Python/root; a local hook runs `pnpm lint` / `prettier` (via `lint-staged`) on staged JS/TS.

### Shared types
No shared types package in Milestone 0. Backend owns Pydantic models; frontend owns local TypeScript types. When the first real API exists (M1/M2), decide whether generating TS from the backend OpenAPI schema (`openapi-typescript`) into a purpose-specific package is worthwhile.

### Smoke / architecture tests
Minimal suite before any business logic:
- application imports successfully,
- configuration loads,
- FastAPI app is created,
- `GET /health` returns 200 (and `GET /health/database` where DB is reachable).

---

## Definition of Done

### Functional

- [ ] Repository builds successfully.
- [ ] Frontend starts successfully.
- [ ] Backend starts successfully.
- [ ] Backend connects to Supabase.
- [ ] Alembic can generate and apply an (empty baseline) migration.
- [ ] Health endpoints respond (`/health`, `/health/database`).
- [ ] Logging works (stdlib wrapped by structlog).
- [ ] Environment validation works (fails fast on missing vars).
- [ ] Linting passes.
- [ ] Formatting passes.
- [ ] Tests pass (smoke tests).
- [ ] CI passes.
- [ ] No business entities, tables, APIs, or UI features exist.

### Architecture validation

- [ ] Folder structure matches `folder_structure.md`.
- [ ] API responses follow `api_contract.md` (and health endpoints follow the infrastructure exception).
- [ ] Theme references `design_tokens.md` (no raw hex in config/components).
- [ ] No generated code violates `.cursorrules` / `.cursor/rules/`.
- [ ] Architecture enforcement checks are scaffolded in CI and pass.
- [ ] No placeholder business code exists (no stub services/repositories/routers/models/pages).

---

## Risks & Assumptions

- **Supabase/PgBouncer prepared statements** — mitigated via `statement_cache_size=0`.
- **Prerequisites:** a Supabase project exists and `DATABASE_URL` + `SUPABASE_*` values are available; `uv`, `pnpm`, Node 22, Python 3.12 installed locally and in CI.
- **Polyglot monorepo** requires both `uv` and `pnpm` in CI.

---

## Out of Scope (Milestone 0)

Any domain entity/table/model, business APIs, auth/JWT/RBAC, Supabase Storage integration, UI pages/features beyond an app shell, charts, notifications, background jobs, caching, and the production Supabase environment.
