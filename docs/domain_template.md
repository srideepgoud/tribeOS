# TribeOS Domain Implementation Template

**Status:** Approved v1.0  
**Version:** 1.0  
**Type:** Implementation guidance (not Tier 1 authoritative)

**Derived from:**
- Clients
- Events

**Last updated after:** `v0.2.0-events`

**Precedence:** Conforms to ADRs 0006/0007 and Tier 1 docs. If this template conflicts with Tier 1, Tier 1 wins.

**Purpose:** Standardize how every remaining business domain is built so modules stay consistent without reinventing patterns.

---

## 1. Required backend files

Every domain lives under `apps/backend/app/domains/<plural_name>/` (ADR 0006):

```
domains/<domain>/
├── __init__.py
├── models.py       # SQLAlchemy ORM model(s) + domain enums
├── schemas.py      # Pydantic Create / Update / Read
├── validators.py   # Pure field normalization (no I/O)
├── repository.py   # Persistence only
├── service.py      # Business rules, state machines, orchestration
└── router.py       # Thin HTTP adapter
```

**Do not** invent alternate layouts (`model.py`, `handlers.py`, etc.).

### Registration checklist

1. Import models in `app/db/migrations/env.py` (Alembic autogenerate).
2. Import models in `tests/conftest.py` (SQLite metadata).
3. Include router in `app/api/routers/__init__.py`.
4. Add Alembic migration; never edit schema via Supabase dashboard.

---

## 2. Models

- Compose mixins in this order: `UUIDPrimaryKeyMixin`, `TimestampMixin`, `AuditUserMixin`, `SoftDeleteMixin`, `Base`.
- Columns must match `docs/db_schema.md` exactly — no invented fields, no omitted documented fields.
- Use Python `StrEnum` for documented statuses; persist **enum values** (e.g. `"Draft"`) via `Enum(..., native_enum=False, values_callable=...)`.
- Money: `Numeric(14, 2)` + `Decimal` in Python — never `float`.
- FK columns: named constraints; indexes per `db_schema.md` recommendations.
- Soft delete: `archived_at`; repositories exclude archived rows on reads.

---

## 3. Validators vs schemas vs service (ADR 0007)

| Layer | Owns | Does not own |
|-------|------|----------------|
| `validators.py` | Trim, blank→`None`, case normalization | DB lookups, state rules |
| `schemas.py` | Types, required/optional, lengths, formats | Business meaning |
| `service.py` | Cross-entity checks, state machine, archive policy | SQL, HTTP status codes |
| DB | NOT NULL, FK, unique | Application messaging |

Flow: request → Pydantic schema → service calls `normalize_*_fields` → persist.

---

## 4. Repository conventions

**Storage-oriented naming** (not ambiguous business words like “active”):

| Method | Meaning |
|--------|---------|
| `get_by_id(id)` | Non-archived row or `None` |
| `get_required(id)` | Non-archived or raise `NotFoundError` |
| `exists(id)` | Boolean non-archived existence |
| `list_paginated(...)` | Filter + search + sort + offset/limit → `(rows, total)` |
| `add(entity)` | `session.add` + `flush` |
| `count_non_archived_by_<fk>(...)` | Counts for cross-domain guards |

Rules:

- Always filter `archived_at.is_(None)` on standard reads.
- Sort via `build_order_by` + explicit whitelist.
- No business rules, no commits (service owns transactions).

---

## 5. Service conventions

### Standard methods (every mutable entity)

```text
get(id)
list(*, page, q, sort, <filters>)
create(payload, *, actor)
update(id, payload, *, actor)   # field updates only
archive(id, *, actor)           # soft delete when policy allows
```

### When the entity has a state machine (Events pattern)

```text
transition_status(id, new_status, *, actor)
```

Plus a centralized map:

```python
ALLOWED_TRANSITIONS: dict[StatusEnum, set[StatusEnum]] = { ... }
```

**Status is never “just another field”.**

- `update()` must exclude / ignore `status`.
- Router `PATCH` dispatches: field keys → `update()`; status change → `transition_status()`.
- Terminal / read-only states → `InvalidStateError` **before** applying mutations.

### Cross-domain rules

Distinguish **read dependencies** from **business orchestration**:

- **Read-only existence / count / lookups** → call the other domain’s **repository**.
  - Example: `ClientService.archive` → `EventRepository.count_non_archived_by_client`.
- **Business workflows spanning multiple domains** → orchestrate from the **owning service** (public service methods only when business orchestration is required).
- **Never** place business rules inside repositories.

Raise `ConflictError` for resource conflicts; `InvalidStateError` for lifecycle violations; `NotFoundError` for missing entities; `DomainValidationError` for business field rules that aren’t pure transport validation.

### Transactions

- Service calls `commit()` + `refresh()` after successful mutations.
- Repository never commits.

---

## 6. Errors

| Class | HTTP | Code | Use |
|-------|------|------|-----|
| `NotFoundError` | 404 | `NOT_FOUND` | Missing / archived-as-missing |
| `ConflictError` | 409 | `CONFLICT` | Uniqueness, archive blocked by dependents |
| `InvalidStateError` | 409 | `INVALID_STATE` | Illegal transition / immutable state |
| `DomainValidationError` | 422 | `VALIDATION_ERROR` | Business validation beyond Pydantic |

Handlers in `app/api/errors/handlers.py` map these to the standard envelope. Do not raise raw HTTP exceptions from services.

---

## 7. Router conventions

```python
router = APIRouter(prefix="/api/v1/<plural-resource>", tags=["<domain>"])
```

| Verb | Path | Status | Envelope |
|------|------|--------|----------|
| GET | `` | 200 | `PaginatedResponse[Read]` |
| GET | `/{id}` | 200 | `DataResponse[Read]` |
| POST | `` | 201 | `DataResponse[Read]` |
| PATCH | `/{id}` | 200 | `DataResponse[Read]` |
| DELETE | `/{id}` | 204 | empty (archive) |

- List deps: `pagination_params`, optional `q`, `sort`, whitelisted filters.
- Mutating routes take `CurrentUser` as `actor` (nullable until Users exists).
- No SQL, no business rules in the router.

### Money in API

- Accept/return `Decimal`; serialize as **numeric string** on Read (`field_serializer`).
- Never JSON floats.

---

## 8. Pagination, sorting, filtering, search

Reuse shared helpers:

- `app.shared.pagination.PageParams` / `pagination_params`
- `app.shared.sorting.build_order_by`
- `app.shared.schemas.DataResponse` / `PaginatedResponse` / `build_pagination_meta`

Defaults: `page=1`, `page_size=20` (max 100).  
Sort: `-field,field` with whitelist.  
Search `q`: case-insensitive `LIKE` on an explicit field list.  
Filters: exact field names (`status`, `client_id`, …) only when documented/needed.

---

## 9. Backend tests

```
tests/domains/<domain>/
├── test_repository.py
├── test_service.py
└── test_api.py
```

Minimum coverage:

- Repository: add/get, excludes archived, search, filters, pagination, `exists` / `get_required` when present.
- Service: create defaults, update, archive policy, not-found; **state machine** valid + invalid paths when applicable; cross-domain guards.
- API: 201 envelope, list meta, 422 validation, 404, soft-delete → 404, **409 `INVALID_STATE`** / `CONFLICT` where relevant.

Use fixtures from `tests/conftest.py` (`db_session`, `api_client`).

---

## 10. Frontend structure

```
apps/web/types/<entity>.ts
apps/web/services/<plural>.ts          # only place that calls the API
apps/web/features/<plural>/
├── schema.ts                          # Zod + payload mappers
├── hooks.ts                           # React Query
└── components/
    ├── <plural>-view.tsx              # page orchestrator
    ├── <entity>-table.tsx
    ├── <entity>-form-dialog.tsx       # create + edit
    ├── archive-<entity>-dialog.tsx    # or delete-* if named that way
    ├── <plural>-empty-state.tsx
    ├── <plural>-loading.tsx
    └── <plural>-error-state.tsx
apps/web/app/<plural>/page.tsx
apps/web/app/<plural>/loading.tsx
apps/web/__tests__/<plural>.test.tsx
```

Also: add nav entry in `components/layout/sidebar-nav.tsx`.

### Hard rules

- UI only from `@tribeos/ui`.
- No `fetch()` outside `services/`.
- No business logic in components (status transition affordances may mirror backend maps for UX only; backend remains source of truth).
- Related entities: load via **existing** hooks/services (e.g. Events uses `useClients`) — do not duplicate foreign state or embed nested write models unless a dedicated read model is introduced later.

### React Query hooks

```ts
const KEY = "<plural>";
useList(params) → queryKey: [KEY, params]
useCreate / useUpdate / useDelete → invalidate [KEY]
```

### Zod

- Mirror transport validation for UX.
- Blank optionals → `null` via `emptyToNull` / `to*Payload`.
- Required fields with clear messages.

### UX states

Always implement empty, loading, error (with retry), and search/filter miss messaging.

---

## 11. Implementation order (every domain)

```text
Database model + migration
  → Repository
  → Validators + Schemas
  → Service (rules / state machine)
  → Router + registration
  → Cross-domain guards (if any)
  → Frontend feature + service + route
  → Tests (repo / service / API / UI)
  → alembic upgrade + full suite green
```

Never skip layers. Never expand into sibling domains in the same phase.

---

## 12. Domain boundaries

A domain may depend on previously implemented domains only through:

- Repository query methods
- Public service methods (only when business orchestration is required)

Do not:

- Import another domain’s models directly outside repositories.
- Share mutable business logic across domains.
- Create circular dependencies between domains.

---

## 13. Checklist before calling a domain “done”

- [ ] Schema matches `db_schema.md`
- [ ] Business rules from `business_rules.md` for this entity (only those enforceable now)
- [ ] State machine exact if entity is stateful
- [ ] Soft delete / archive policy correct
- [ ] Standard API envelope + list conventions
- [ ] `InvalidStateError` / `ConflictError` used appropriately
- [ ] Frontend empty/loading/error + archive UX
- [ ] Repo + service + API + frontend tests green
- [ ] Migration applied
- [ ] Intentionally deferred items listed in the handoff

---

## 14. What this template does not authorize

- Changing frozen Tier 1 documents
- Inventing columns or entity names
- Placing business logic in routers, repositories, or React components
- Implementing deferred modules early (Auth, Storage, Audit Log entity, finance side-effects of later domains)

---

## Reference implementations

| Pattern | Canonical example |
|---------|-------------------|
| Simple CRUD + soft archive | `domains/clients/` |
| State machine + FK parent + cross-domain archive guard | `domains/events/` |
| Frontend feature layout | `features/clients/`, `features/events/` |
| Shared infra | `app/db/mixins.py`, `app/shared/{pagination,sorting,schemas,errors}.py` |

---

## Approval

**Approved v1.0.** Default blueprint for **Cost Categories**, **Cost Items**, and all subsequent domains unless superseded by a newer ADR or a later template version.
