# TribeOS API Contract

**Status:** Approved v1.0

**Purpose:** Defines the API conventions every TribeOS endpoint must follow — response envelope, errors, pagination, sorting, filtering, search, status codes, and versioning. Define once; apply everywhere.

---

## General Principles

1. REST only. All routes are versioned under `/api/v1/`.
2. Every response uses the standard envelope below.
3. Validation is enforced in the backend (Pydantic + Service layer).
4. Never expose stack traces or internal implementation details.
5. Consistent, predictable shapes across all endpoints.

---

## Versioning

- All **business** routes are prefixed with `/api/v1/`.
- Future breaking changes go under `/api/v2/`; avoid breaking existing versions.

### Infrastructure endpoints (exception)

Infrastructure/operational endpoints are **not** versioned and live outside `/api/v1/`, so load balancers, uptime checks, and deployment platforms can consume them at stable paths:

- `GET /health` — liveness
- `GET /health/database` — database connectivity

These are not business APIs and are exempt from the envelope/versioning rules where it conflicts with standard health-check conventions.

---

## Standard Response Envelope

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

- `data` — the resource or list requested (object or array).
- `meta` — optional metadata (pagination, counts). Omit or `{}` when not applicable.

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE",
    "message": "Closed events cannot be modified."
  }
}
```

- `code` — stable, machine-readable, `SCREAMING_SNAKE_CASE`.
- `message` — human-readable; safe to display. Never leak internals or stack traces.
- Optional `error.details` may carry field-level validation errors (see below).

---

## Collections: Pagination, Sorting, Filtering, Search

List endpoints share the same query-parameter conventions.

### Pagination

Query params:

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | int | `1` | 1-based page number |
| `page_size` | int | `20` | Items per page (max `100`) |

Paginated responses populate `meta`:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 137,
      "total_pages": 7
    }
  }
}
```

### Sorting

- Param: `sort`
- Format: comma-separated fields; prefix `-` for descending.
- Example: `?sort=-created_at,name`

### Filtering

- Field filters use the field name directly: `?status=Draft&client_id=<uuid>`.
- Range filters use suffixes: `_gte`, `_lte`, `_gt`, `_lt`.
  - Example: `?transaction_date_gte=2026-01-01&transaction_date_lte=2026-03-31`
- Only whitelisted fields per endpoint are filterable.

### Search

- Param: `q` — free-text search across endpoint-defined searchable fields.
- Example: `?q=stage`

Combined example:

```
GET /api/v1/events?status=Planning&sort=-start_datetime&page=2&page_size=25&q=wedding
```

---

## HTTP Status Codes

| Code | Meaning | When |
| --- | --- | --- |
| `200 OK` | Success | Successful read/update |
| `201 Created` | Created | Resource created |
| `204 No Content` | Success, no body | Successful delete/archive |
| `400 Bad Request` | Malformed request | Invalid params/body shape |
| `401 Unauthorized` | Not authenticated | Missing/invalid token |
| `403 Forbidden` | Not authorized | Authenticated but lacks permission |
| `404 Not Found` | Missing | Resource does not exist |
| `409 Conflict` | Invalid transition / conflict | Invalid state transition, unique constraint |
| `422 Unprocessable Entity` | Validation failed | Pydantic/field validation errors |
| `500 Internal Server Error` | Unexpected | Unhandled error (no stack trace exposed) |

> Invalid state-machine transitions **always** return `409 Conflict` (see `docs/state_machine.md`).

---

## Validation Errors

Field-level validation errors use `422` with structured details:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "amount", "message": "must be greater than or equal to 0" },
      { "field": "email", "message": "invalid email format" }
    ]
  }
}
```

---

## Error Codes (baseline)

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Field validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INVALID_STATE` | 409 | Invalid state transition |
| `CONFLICT` | 409 | Uniqueness or concurrency conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

Domains may add specific codes as needed; they must remain `SCREAMING_SNAKE_CASE` and documented.

---

## Conventions

- Resource paths are plural nouns: `/api/v1/events`, `/api/v1/vendor-work-orders`.
- Use kebab-case for multi-word path segments.
- IDs in paths are UUIDs: `/api/v1/events/{event_id}`.
- Timestamps are ISO 8601 UTC.
- Money is returned as a numeric string or integer minor units (decided per finance domain implementation) — never a lossy float.
- Every mutating endpoint validates authentication, authorization, and business rules, and generates an Audit Log where applicable.

---

## Status

**APPROVED**

This document is the authoritative API contract for TribeOS v1.0. All routers, response models, and frontend API services must comply.
