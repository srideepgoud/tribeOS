# ADR 0006: Domain Module File Naming Convention

**Status:** Accepted
**Date:** 2026-07-20
**Supersedes:** the singular domain file names (`model.py`, `schema.py`) documented in `ARCHITECTURE.md` and `docs/folder_structure.md`

## Context

`ARCHITECTURE.md` and `docs/folder_structure.md` describe each domain module using singular file names and no dedicated validation file:

```
domains/<domain>/
├── model.py
├── repository.py
├── service.py
├── schema.py
└── router.py
```

The first real business module (Clients) was implemented with **plural** names and a dedicated `validators.py`:

```
domains/<domain>/
├── models.py
├── schemas.py
├── validators.py
├── repository.py
├── service.py
└── router.py
```

Because the project documents are frozen, this divergence must be resolved explicitly rather than left as a silent inconsistency — otherwise every future domain (Events, Vendors, Finance, Documents) would replicate an unratified convention.

## Decision

Adopt the **plural** convention with a dedicated validation module as the standard for all domain modules:

```
domains/<domain>/
├── models.py       # SQLAlchemy ORM model(s)
├── schemas.py      # Pydantic request/response schemas (transport validation)
├── validators.py   # field normalization used before persistence
├── repository.py   # data access only — no business logic
├── service.py      # business logic, orchestration, state transitions
└── router.py       # thin controller — no SQL, no business logic
```

This ADR supersedes the singular file names in `ARCHITECTURE.md` and `docs/folder_structure.md`. The layering **responsibilities** described in those documents remain unchanged; only the file names and the addition of `validators.py` are affected. The split between `validators.py`, `schemas.py`, and `service.py` is defined in ADR 0007.

Rationale:

- **Scales with growth:** a module that outgrows a single file becomes a package (`models/`, `schemas/`) without renaming.
- **Common convention:** matches widespread FastAPI/SQLAlchemy project layouts.
- **Separation of concerns:** validation/normalization is separated from transport schemas.
- **Already implemented:** Clients uses this shape; ratifying it avoids churn.

## Consequences

- **Positive:** one consistent, documented module shape for every domain; no silent divergence from frozen docs.
- **Positive:** Events and later domains have an unambiguous template to copy.
- **Trade-off:** `ARCHITECTURE.md` / `folder_structure.md` wording is now partially superseded; readers must follow this ADR for file names (the responsibility model in those documents still holds).
