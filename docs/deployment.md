# TribeOS Deployment Guide

**Status:** Operational runbook (not a frozen Tier-1 spec)  
**Audience:** Engineer deploying TribeOS for the first time or promoting a release  
**Last aligned with:** current monorepo (FastAPI + Next.js + Supabase PostgreSQL)

This guide walks through a **production-shaped** deployment: separate database project, backend API, frontend app, migrations, verification, and rollback. It matches what the codebase actually supports today. Where tooling is still scaffold-only (`docker/`, `.github/`, Auth, Storage), the guide says so and gives a safe interim path.

---

## 0. What you are deploying

```
Browser  →  Next.js (apps/web)  →  HTTPS REST  →  FastAPI (apps/backend)
                                                      ↓
                                            Supabase PostgreSQL
                                            (Alembic-owned schema)
```

| Layer | Package | Runtime |
| --- | --- | --- |
| Frontend | `apps/web` | Node.js 22, Next.js 15 (`next start`) |
| Backend | `apps/backend` | Python 3.12, Uvicorn + FastAPI |
| Database | Supabase Postgres | Connection via `DATABASE_URL` (`postgresql+asyncpg://…`) |
| Schema | Alembic | Sole authority — never edit tables in the Supabase dashboard |

**Not in this deploy yet (deferred by ADR / milestone):**

- Docker images / Compose (folder exists; no Dockerfiles)
- GitHub Actions CD (folder exists; no workflows)
- Supabase Auth / JWT + RBAC
- Supabase Storage

Until Auth ships, treat every public URL as **unauthenticated**. Prefer private networking (VPN, Tailscale, IP allowlist, or platform “private service”) for anything beyond a trusted internal demo.

---

## 1. Prerequisites

Install on the machine that will build and/or run migrations:

| Tool | Version | Notes |
| --- | --- | --- |
| Git | latest | Clone the repo |
| Node.js | 22 LTS | Pinned in `.nvmrc` |
| pnpm | 10.x | Pinned via root `package.json` `packageManager` |
| Python | 3.12 | Pinned in `apps/backend/.python-version` |
| uv | current stable | Backend deps + Alembic |
| Supabase account | — | Create a **production** project (separate from development) |

Optional but recommended:

- A secrets store (platform env UI, 1Password, Doppler, etc.)
- An uptime check against `/health` and `/health/database`

---

## 2. Choose hosting (recommended defaults)

TribeOS does not yet ship first-party Docker images. Use a platform that can run a Node process and a Python process (or two platforms).

| Component | Good fit | Why |
| --- | --- | --- |
| Database | **Supabase** (new project) | Matches ADR 0003/0004; same engine as development |
| Backend API | Railway, Render, Fly.io, or a small VM | Long-lived ASGI process; easy env vars |
| Frontend | **Vercel**, or same host as backend | Native Next.js deploy |

You can run both apps on one VM with systemd/nginx if you prefer full control. The steps below stay platform-agnostic: set env vars → migrate → start processes → point DNS.

**Minimum topology for a real internal deploy:**

1. Production Supabase project (DB only for now)
2. Backend service with a public HTTPS URL (or private URL + VPN)
3. Frontend service with HTTPS URL that calls the backend

---

## 3. Create the production Supabase project

Per architecture: development uses one Supabase project; **production must be a separate project** before real use.

1. In [Supabase](https://supabase.com), create a new project (region closest to Tribe / users).
2. Save the database password in your secrets store.
3. From **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to the browser)
4. From **Project Settings → Database**, copy connection strings.

### Connection string rules (critical)

TribeOS expects an **async** SQLAlchemy URL:

```text
postgresql+asyncpg://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

or the direct host form:

```text
postgresql+asyncpg://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
```

Notes:

- Prefix must be `postgresql+asyncpg://` (not `postgresql://`).
- URL-encode special characters in the password.
- The app disables prepared-statement caching so it stays safe behind Supabase’s PgBouncer (`statement_cache_size=0` in `app/db/session.py`).
- **Best practice:** run the **API** against the **transaction pooler** (port `6543`), and run **Alembic migrations** against the **direct** connection (port `5432`) or session mode. DDL through transaction pooling is unreliable.

Do **not** create tables, enums, or policies in the Supabase SQL editor. Schema changes go through Alembic only.

---

## 4. Prepare environment variables

### 4.1 Backend (process / platform env)

Mirror `.env.example` at the repo root. For production:

| Variable | Required | Example / guidance |
| --- | --- | --- |
| `APP_ENV` | yes | `production` |
| `LOG_LEVEL` | no | `INFO` (default) |
| `DATABASE_URL` | yes | `postgresql+asyncpg://…` (pooler for the API) |
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | yes | from Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | from Supabase API settings (server-only) |
| `CORS_ORIGINS` | yes in prod | Exact frontend origin(s), comma-separated |

Example:

```bash
APP_ENV=production
LOG_LEVEL=INFO
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CORS_ORIGINS=https://app.tribeos.example.com
```

Never commit real `.env` files. Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

### 4.2 Frontend (`apps/web`)

Mirror `apps/web/.env.example`. On the host / Vercel:

| Variable | Required | Guidance |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | Public base URL of the backend **without** a trailing slash (e.g. `https://api.tribeos.example.com`) |

`NEXT_PUBLIC_*` is baked into the client bundle at **build** time. Set it before `pnpm build` / the platform’s build step. Changing it later requires a rebuild.

---

## 5. Get the code and install dependencies

On a CI runner, bastion, or deploy machine:

```bash
git clone <your-remote-url> tribeOS
cd tribeOS
git checkout main
git pull

# JS workspace
corepack enable
pnpm install

# Python backend
cd apps/backend
uv sync
cd ../..
```

Windows (PowerShell) is fine for the same commands; use the Makefile only on Unix/Git Bash/WSL.

---

## 6. Run database migrations (production)

Migrations are mandatory before (or as part of) cutting traffic to a new backend revision.

```bash
cd apps/backend

# Prefer DIRECT DB URL for migrations (port 5432), not the transaction pooler.
# Temporarily point DATABASE_URL at the direct connection if your API uses the pooler.
uv run alembic upgrade head
```

Verify:

```bash
uv run alembic current
```

Expected: revision matches the latest file under `apps/backend/app/db/migrations/versions/`.

If anything fails:

1. Do **not** “fix” the schema in the Supabase dashboard.
2. Inspect the failed revision, fix in a **new** migration if needed, re-run.
3. Keep financial / append-only history intact — never drop production tables casually.

---

## 7. Deploy the backend

### 7.1 Build / install on the host

```bash
cd apps/backend
uv sync --no-dev
```

### 7.2 Start the API

Bind to the platform’s `$PORT` when required:

```bash
cd apps/backend
uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

For production capacity (after you measure), a typical process manager command looks like:

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
```

Notes:

- Entry module is `app.main:app` (factory already called at import).
- Terminate TLS at the platform / reverse proxy; the app speaks HTTP behind it.
- Set `CORS_ORIGINS` to the **exact** browser origin of the Next.js app (scheme + host + port if non-default).

### 7.3 Smoke-check the API

```bash
curl -sS https://api.tribeos.example.com/health
# {"status":"ok"}

curl -sS https://api.tribeos.example.com/health/database
# {"status":"ok","database":"reachable"}
```

These paths are intentional infrastructure endpoints outside `/api/v1/` (see `docs/api_contract.md`).

Business API lives under `/api/v1/…` (clients, events, invoices, transactions, dashboard, etc.).

---

## 8. Deploy the frontend

From the monorepo root (so the `@tribeos/ui` workspace package resolves):

```bash
pnpm install
# Ensure NEXT_PUBLIC_API_URL is set in the environment for this shell / CI job
export NEXT_PUBLIC_API_URL=https://api.tribeos.example.com

pnpm --filter @tribeos/web build
pnpm --filter @tribeos/web start
```

Or on Vercel:

1. Root directory: repo root (or configure install to use pnpm workspaces).
2. Build command: `pnpm --filter @tribeos/web build` (adjust if the platform’s app root is `apps/web`).
3. Output: Next.js default.
4. Env: `NEXT_PUBLIC_API_URL=https://api.tribeos.example.com`.

Open the frontend URL and confirm the UI can list/create against the API (network tab should hit your production API host, not `localhost:8000`).

---

## 9. Wire DNS, HTTPS, and CORS

1. Point `api.<domain>` → backend service.
2. Point `app.<domain>` (or apex) → frontend.
3. Enable HTTPS on both (platform-managed certificates are fine).
4. Set backend `CORS_ORIGINS` to the frontend origin only (no wildcards unless you fully understand the risk).
5. Rebuild/restart backend after CORS changes.

Checklist:

- [ ] Frontend origin loads over HTTPS
- [ ] Browser calls go to production `NEXT_PUBLIC_API_URL`
- [ ] No CORS errors in the browser console
- [ ] `/health` and `/health/database` succeed

---

## 10. Post-deploy verification

Run through this once per environment:

| Check | How |
| --- | --- |
| Liveness | `GET /health` → `ok` |
| DB readiness | `GET /health/database` → `reachable` |
| Migrations | `alembic current` = `head` |
| CORS | Browser can call `/api/v1/...` from the web origin |
| Domain smoke | Create a Client → Event → Cost Category path in the UI |
| Finance smoke | Transaction + Cost Allocation; Client Invoice issue/pay path if used |
| Logging | Structured logs appear in the platform log stream |
| Secrets | No service-role key in browser bundle / Network responses |

Until Auth exists, also confirm the deployment is **not** indexed or publicly advertised (robots, no public marketing DNS if avoidable).

---

## 11. Release procedure (repeatable)

Use this sequence for every production promotion:

1. **Freeze** the commit: `git rev-parse HEAD` and note it in your release notes.
2. **CI locally or in CI:** `pnpm test`, backend `uv run pytest`, lint/typecheck as available.
3. **Backup:** take a Supabase backup / snapshot before migrations that alter financial tables.
4. **Migrate:** `uv run alembic upgrade head` against production (direct DB URL).
5. **Deploy backend** to that same commit; confirm `/health/database`.
6. **Deploy frontend** with the correct `NEXT_PUBLIC_API_URL`; hard-refresh and smoke-test.
7. **Watch** error logs for 15–30 minutes.

Never deploy frontend against an old API that is missing routes the UI expects, and never leave the API on a revision that expects columns migrations have not applied.

---

## 12. Rollback

### Application rollback

1. Redeploy the previous known-good git commit for backend and frontend.
2. Confirm `/health` and a critical UI path.

### Migration rollback

Alembic downgrades are possible in theory (`alembic downgrade -1`) but **dangerous** on financial data (immutable Transactions, Audit Logs, append-only history). Prefer:

1. Fix forward with a new migration.
2. Only downgrade on empty / disposable environments.

If a bad migration partially applied, stop the API, restore from the pre-migrate backup, fix the migration on a branch, and re-promote.

---

## 13. Security baseline (pre-Auth)

Until JWT + RBAC land:

- Restrict who can reach the frontend and API (VPN, IP allowlist, private networking).
- Keep `SUPABASE_SERVICE_ROLE_KEY` only on the backend.
- Rotate DB password and API keys if they ever appear in chat, screenshots, or git history.
- Do not open Supabase DB ports beyond what the backend needs.
- Treat production data as real Tribe financial data from day one.

---

## 14. Local vs production (quick contrast)

| Concern | Development | Production |
| --- | --- | --- |
| Supabase project | Single shared **dev** project (ADR 0003) | **Separate** project |
| Schema edits | Alembic only | Alembic only |
| `APP_ENV` | `development` | `production` |
| `CORS_ORIGINS` | Localhost defaults OK | Exact prod frontend origin(s) |
| Frontend API URL | `http://localhost:8000` | HTTPS API URL |
| Reset DB | Acceptable while schema evolves | Backup first; no casual resets |

---

## 15. When Docker / CI are ready

The repo already reserves:

- `docker/` — add Dockerfiles for `apps/backend` and `apps/web`
- `.github/` — add workflows for lint, test, migrate-on-release, deploy
- `scripts/` — add migrate/deploy helpers

Until those land, this runbook (manual env + `uvicorn` + `next start`) is the supported path. Prefer implementing Docker only when you need identical runtime images across environments; do not block a first internal deploy on empty folders.

---

## 16. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Backend won’t start | Missing env / invalid `DATABASE_URL` | Compare with `.env.example`; ensure `postgresql+asyncpg://` |
| `/health/database` fails | Wrong password, SSL, or network | Test URL with direct host; check Supabase project status |
| CORS errors in browser | `CORS_ORIGINS` mismatch | Include exact origin (`https://app…` not `https://app…/`) |
| Frontend still hits localhost | Stale build-time env | Rebuild with correct `NEXT_PUBLIC_API_URL` |
| Migration hangs / fails on pooler | DDL via transaction pooler | Use direct `5432` URL for Alembic |
| Tables appear “wrong” in dashboard | Manual SQL edits | Revert to Alembic-owned state; never dashboard-edit |

---

## 17. Definition of “deployed”

TribeOS is successfully deployed when all of the following are true:

- [ ] Production Supabase project exists and is separate from development
- [ ] `alembic upgrade head` applied cleanly
- [ ] Backend serves `/health` and `/health/database` over HTTPS (or private VPN URL)
- [ ] Frontend is HTTPS and talks only to that backend
- [ ] `CORS_ORIGINS` allows the frontend origin
- [ ] Smoke paths for core domains succeed
- [ ] Secrets are not in git or the browser
- [ ] Access is restricted appropriately given Auth is not yet shipping

---

## Appendix A — Exact path: Render (API) + Vercel (Web) + existing Supabase

Use this when you already have one Supabase project and want the simplest public deploy. Order matters: migrate locally → Render → Vercel → fix CORS → redeploy Render.

> **Caveat:** Sharing the same Supabase project for local + Render means both environments write to the same database. Fine for a personal/internal demo; split projects later before real Tribe ops.

### A.0 Prerequisites

- [ ] Repo is on GitHub (`main` up to date)
- [ ] Supabase project already created
- [ ] Accounts on [Render](https://render.com) and [Vercel](https://vercel.com)
- [ ] Local machine can run `uv` + Alembic against Supabase

### A.1 Copy values from Supabase

In the Supabase dashboard for your project:

1. **Project Settings → API**
   - Project URL → `SUPABASE_URL` (e.g. `https://abcdefgh.supabase.co`)
   - `anon` `public` → `SUPABASE_ANON_KEY`
   - `service_role` `secret` → `SUPABASE_SERVICE_ROLE_KEY`
2. **Project Settings → Database → Connection string → URI**
   - Prefer **Transaction** pooler (port `6543`) for the Render API.
   - Copy the URI, then rewrite the scheme:

```text
# Supabase shows something like:
postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres

# TribeOS needs:
postgresql+asyncpg://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

URL-encode special characters in the password (`@` → `%40`, etc.).

### A.2 Apply migrations (from your laptop)

Do this once before (or whenever ahead of) the first Render deploy:

```bash
cd apps/backend
# Use your existing local .env DATABASE_URL (same Supabase project).
# Prefer direct host :5432 for migrations if the pooler fails on DDL.
uv run alembic upgrade head
uv run alembic current
```

Confirm `current` is at head. Do not create tables in the Supabase SQL editor.

### A.3 Deploy backend on Render

1. Open Render → **New +** → **Web Service**.
2. Connect the GitHub repo `tribeOS` (or your fork). Branch: `main`.
3. Configure:

| Field | Value |
| --- | --- |
| Name | `tribeos-api` (or similar) |
| Language | **Python 3** |
| Root Directory | `apps/backend` |
| Branch | `main` |
| Build Command | `pip install uv && uv sync --no-dev` |
| Start Command | `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance type | Free or Starter |

4. **Environment → Add Environment Variable** (all as secrets where possible):

| Key | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `LOG_LEVEL` | `INFO` |
| `DATABASE_URL` | `postgresql+asyncpg://…` (from A.1) |
| `SUPABASE_URL` | from A.1 |
| `SUPABASE_ANON_KEY` | from A.1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from A.1 |
| `CORS_ORIGINS` | leave blank for now, or set after Vercel (A.5) |

5. Click **Create Web Service** and wait until the deploy is **Live**.
6. Copy the service URL, e.g. `https://tribeos-api.onrender.com` (no trailing slash).
7. Verify:

```bash
curl https://tribeos-api.onrender.com/health
curl https://tribeos-api.onrender.com/health/database
```

Both should return `"status":"ok"`. If database health fails, fix `DATABASE_URL` (scheme, password encoding, pooler host) and **Manual Deploy**.

> Free Render services spin down after idle; the first request after sleep can take ~30–60s.

### A.4 Deploy frontend on Vercel

1. Open Vercel → **Add New…** → **Project** → Import the same GitHub repo.
2. Configure:

| Field | Value |
| --- | --- |
| Framework Preset | **Next.js** |
| Root Directory | `apps/web` → click **Edit** |
| Build Command | `pnpm build` (default is fine once install works) |
| Output Directory | leave default (Next.js) |
| Install Command | `cd ../.. && corepack enable && pnpm install` |

3. Under Root Directory, enable including files outside the root if Vercel shows that option (needed for `packages/ui`).
4. **Environment Variables** (Production + Preview):

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://tribeos-api.onrender.com` ← your real Render URL, **no trailing slash** |

5. Deploy. When finished, copy the Vercel URL, e.g. `https://tribeos-xxx.vercel.app`.
6. Open that URL in a browser. If the UI loads but API calls fail with CORS, continue to A.5.

If the build fails on `@tribeos/ui` / workspace resolution:

- Confirm Install Command runs from the monorepo root (`cd ../.. && pnpm install`).
- Confirm Root Directory is exactly `apps/web`.

### A.5 Fix CORS (required)

1. Render → `tribeos-api` → **Environment**.
2. Set:

```text
CORS_ORIGINS=https://tribeos-xxx.vercel.app
```

Use the exact Vercel origin (scheme + host, no path, no trailing slash). If you also use a custom domain later, comma-separate both:

```text
CORS_ORIGINS=https://tribeos-xxx.vercel.app,https://app.yourdomain.com
```

3. **Save** → **Manual Deploy** → **Deploy latest commit** (env changes need a restart).
4. Hard-refresh the Vercel site and confirm Network calls to `/api/v1/...` succeed.

### A.6 End-to-end smoke test

1. `GET https://<render>/health` → ok  
2. `GET https://<render>/health/database` → ok  
3. On Vercel UI: create a Client, then an Event  
4. Confirm rows appear in Supabase **Table Editor** (read-only check; still no manual schema edits)

### A.7 Later deploys

| Change type | What to do |
| --- | --- |
| Backend code | Push `main` → Render auto-deploys (if connected) |
| Frontend code | Push `main` → Vercel auto-deploys |
| New Alembic migration | Run `uv run alembic upgrade head` locally against the same Supabase, **then** deploy backend |
| Changed `NEXT_PUBLIC_API_URL` | Update Vercel env → **Redeploy** (rebuild required) |
| New frontend domain | Add to `CORS_ORIGINS` on Render → redeploy API |

### A.8 Common failures

| Symptom | Fix |
| --- | --- |
| Render: `DATABASE_URL` validation / startup crash | Must start with `postgresql+asyncpg://` |
| `/health/database` 500 | Password encoding, wrong project, or DB paused |
| Vercel build: cannot find `@tribeos/ui` | Install from repo root (`cd ../.. && pnpm install`) |
| Browser CORS error | `CORS_ORIGINS` must equal the Vercel origin exactly; redeploy Render |
| UI calls `localhost:8000` | `NEXT_PUBLIC_API_URL` missing at build time → set env and Redeploy on Vercel |
| Slow first API call | Render free tier cold start — wait and retry |

---

## Related documents

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — system topology
- [`docs/adr/0003-supabase-primary-dev-database.md`](./adr/0003-supabase-primary-dev-database.md)
- [`docs/adr/0004-supabase-development-environment.md`](./adr/0004-supabase-development-environment.md)
- [`docs/api_contract.md`](./api_contract.md) — `/health` vs `/api/v1`
- [`.env.example`](../.env.example) — backend env template
- [`apps/web/.env.example`](../apps/web/.env.example) — frontend env template
