# ADR 0007: Validation Responsibilities Across Layers

**Status:** Accepted
**Date:** 2026-07-20
**Related:** ADR 0006 (Domain Module File Convention); `ARCHITECTURE.md` (Validation Strategy)

## Context

TribeOS validates at multiple layers (frontend Zod, backend Pydantic, service-layer business rules, database constraints — see `ARCHITECTURE.md`). Within a backend domain module there are now three places that can touch inbound data: `schemas.py` (Pydantic), `validators.py`, and `service.py`. Without an explicit rule for what belongs where, each future domain risks placing the same concern in a different layer, producing inconsistent and hard-to-review modules.

## Decision

Define a single, explicit responsibility for each layer. Data flows in this order:

```
validators.py   →   schemas.py   →   service.py
 (normalization)     (transport)      (business rules)
```

**`validators.py` — normalization only (pure, no I/O):**

- trim strings
- lowercase where appropriate (e.g. email)
- convert blank optional strings to `null`
- other pure, deterministic shaping of already-typed values

**`schemas.py` (Pydantic) — transport validation:**

- required vs optional fields
- type coercion and format checks (e.g. `EmailStr`, max lengths)
- request/response shape

**`service.py` — business rules:**

- uniqueness and cross-entity checks
- state-machine transitions
- policies that require the database or other domains (e.g. "cannot archive while active Events exist")

**Database — constraints:** the final integrity backstop (NOT NULL, FK, unique).

Guidelines:

- Business rules never live in `router.py`, `repository.py`, `models.py`, `schemas.py`, or `validators.py`.
- `validators.py` must remain pure (no DB/session access, no cross-entity lookups); anything needing I/O or other entities belongs in `service.py`.
- The frontend (Zod) mirrors transport validation for UX only; the backend remains the source of truth.

## Consequences

- **Positive:** every domain places validation consistently, making modules predictable and reviewable.
- **Positive:** clear guidance for the Events module and beyond.
- **Trade-off:** occasionally a check could plausibly sit in two layers; when in doubt, prefer `service.py` for anything involving business meaning or I/O, and keep `validators.py` strictly pure.
