# ADR 0003: Supabase as Primary Development Database

**Status:** Accepted
**Date:** 2026-07-19
**Supersedes:** the earlier recommendation to use Docker PostgreSQL for local development

## Context

TribeOS is an internal ERP built by a solo developer. Early scaffolding assumed a local Docker PostgreSQL container as the development database. In practice, the priority is development speed, and the project already relies on Supabase for storage.

The schema is still evolving, and resetting the development database during this phase is acceptable.

## Decision

Use a **single Supabase project** as the primary development database from the beginning of the project.

- Supabase PostgreSQL is the single development database — no local PostgreSQL is run.
- Alembic remains the authoritative migration tool; every schema change is an Alembic migration.
- Manual schema edits through the Supabase dashboard are prohibited.
- Resetting the development database is acceptable while the schema evolves.
- A separate production Supabase project will be introduced only when the application approaches real production use.

Connection and credentials are provided via environment variables: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).

Docker Compose is not used for local development. It will be introduced only if a future service (e.g. Redis, MinIO, Mailhog) requires it.

## Consequences

- **Positive:** faster setup, one less local service to manage, parity between the dev database and the eventual production platform (both Supabase).
- **Positive:** storage, auth, and database live on one platform.
- **Trade-off:** development requires network access to Supabase; there is no offline local database.
- **Trade-off:** discipline is required to never edit the schema via the dashboard — Alembic is the only sanctioned path.
- **Follow-up:** a production Supabase project and its promotion process will be defined in a future ADR when the app nears production.
