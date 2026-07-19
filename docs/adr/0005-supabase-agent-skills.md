# ADR 0005: Adopt Supabase Agent Skills as Implementation Guidance

**Status:** Accepted
**Date:** 2026-07-19
**Related:** ADR 0003 (Supabase as Primary Development Database), ADR 0004 (Supabase Development Environment)

## Context

TribeOS builds on Supabase from day one (PostgreSQL now; Storage and Auth deferred to later milestones). Supabase publishes **Agent Skills** — guidance that helps AI coding assistants generate code aligned with current Supabase best practices (client usage, Storage APIs, connection patterns, auth patterns, Supabase-specific conventions).

Because we build on Supabase, this guidance can improve the quality of AI-generated Supabase code. However, Agent Skills describe *how to use Supabase*, not *how TribeOS is architected*. Left unscoped, they could nudge the codebase toward a different folder structure, data model, or API design, or introduce deferred capabilities (Auth, Storage) ahead of their milestone.

## Decision

Adopt Supabase Agent Skills as **implementation guidance only**, at the lowest precedence.

**Precedence (highest → lowest):**

1. Frozen project documents — `docs/*`, ADRs, `AI_CONTEXT.md`, `ARCHITECTURE.md` (see `docs/document_hierarchy.md`)
2. `.cursorrules` and `.cursor/rules/*`
3. **Supabase Agent Skills** — Supabase-specific implementation details only

**Rules:**

- Use Supabase Agent Skills **only** for Supabase-specific implementation details (e.g. the correct way to configure a client, connect to the database, or upload a file to Supabase Storage).
- They must **not** override the project's architecture, folder structure, domain model, business rules, API design, terminology, or milestone scope.
- If a skill suggests a different folder structure, data model, or API design → **ignore it**.
- They must **not** introduce deferred capabilities (Supabase **Auth**, Supabase **Storage** integration) before the milestone that owns them. In particular, nothing from these skills may be introduced during **Milestone 0**.

Installing the skills into Cursor is an editor/account-side action; this ADR governs how they are *used* once available.

## Consequences

- **Positive:** higher-quality, up-to-date Supabase-specific code, especially in later Storage/Auth/deployment milestones.
- **Positive:** the boundary between external guidance and project authority is explicit and enforceable.
- **Trade-off:** contributors and AI assistants must actively disregard skill suggestions that conflict with frozen documents or milestone scope.
- **Follow-up:** revisit when Supabase Storage (documents) and Auth are scheduled, to confirm the skills are applied within their intended scope.
