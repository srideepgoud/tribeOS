# ADR 0002: Domain-First Backend Structure

**Status:** Accepted
**Date:** 2026-07-19
**Supersedes:** the layer-first backend layout previously sketched in `ARCHITECTURE.md`

## Context

An early draft of `ARCHITECTURE.md` organized the backend by technical layer (`models/`, `repositories/`, `services/`, `schemas/` as global folders). TribeOS is expected to grow to well over a hundred backend files across many domains (Clients, Events, Vendors, Finance, Documents, etc.).

With layer-first organization, working on a single feature requires jumping between many sibling folders, and each folder accumulates unrelated files from every domain. This friction grows with the codebase.

## Decision

Adopt a **domain-first (vertical feature module)** structure. Business logic is grouped under `app/domains/<domain>/`, where each domain owns its full vertical slice:

```
domains/<domain>/
├── model.py
├── repository.py
├── service.py
├── schema.py
└── router.py
```

Global layer folders (`models/`, `repositories/`, `services/`, `schemas/`) are not used. The layering rules (routers thin, services own business logic, repositories data-only) are enforced *inside* each domain module. Shared infrastructure remains in `api/`, `core/`, `db/`, and cross-domain code in `shared/`.

This is documented authoritatively in `docs/folder_structure.md`, and `ARCHITECTURE.md` has been updated to match.

## Consequences

- **Positive:** high cohesion (everything about a domain lives together), easier navigation at scale, clean mapping to entity ownership, easier to reason about domain boundaries.
- **Positive:** layer discipline is preserved via file responsibilities within each module.
- **Trade-off:** cross-domain shared logic must be deliberately placed in `shared/` to avoid duplication or inappropriate coupling.
- **Trade-off:** contributors used to layer-first frameworks need to learn the convention (mitigated by `docs/folder_structure.md`).
