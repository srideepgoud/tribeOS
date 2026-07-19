# ADR 0004: Supabase Development Environment

**Status:** Accepted
**Date:** 2026-07-19
**Related:** ADR 0003 (Supabase as Primary Development Database) — this ADR consolidates the full Supabase-based development environment, of which the database decision in ADR 0003 is a part.

## Context

TribeOS relies on Supabase for multiple platform capabilities (PostgreSQL database and object storage). Rather than leaving this as scattered references across the documentation, the overall development environment decision is recorded here as a single architectural decision.

## Decision

TribeOS uses **Supabase as its development environment**:

- We use a single Supabase project during development.
- Alembic is the only migration mechanism.
- Manual schema edits (including via the Supabase dashboard) are prohibited.
- Supabase Storage is the document storage backend (the database stores metadata only).
- A separate production environment will be introduced before launch.

Connection and credentials are provided via environment variables: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).

## Consequences

- **Positive:** one platform for database and storage; fast setup; dev/prod parity on the same technology.
- **Positive:** the Supabase choice is now a documented decision rather than implicit convention.
- **Trade-off:** development depends on network access to Supabase; no fully offline mode.
- **Trade-off:** discipline required to keep Alembic as the sole schema authority.
- **Follow-up:** a future ADR will define the production Supabase project and the promotion/migration process before launch.
