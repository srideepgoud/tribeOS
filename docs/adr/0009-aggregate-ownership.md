# ADR 0009: Aggregate Ownership Boundaries

**Status:** Accepted
**Date:** 2026-07-20
**Related:** ADR 0002 (domain-first structure); ADR 0006 (domain module files); `docs/domain_model.md`; `docs/folder_structure.md`; `docs/domain_template.md`

## Context

Through Clients → Events → Cost Categories → Cost Items (+ Versions), TribeOS has established consistent aggregate boundaries in code:

- child entities are updated only via their parent’s service
- cross-entity invariants live in services
- repositories do not mutate foreign aggregates

These rules were implicit. As Vendor Work Orders and Transactions begin to span multiple aggregates, the boundaries must be explicit so contributors do not invent competing write paths or circular dependencies.

## Decision

### Ownership map (as of Cost Items)

```text
Client
  owns → Event

Event
  owns → Cost Category
  owns → Cost Item

Cost Item
  owns → Cost Item Version
```

Later aggregates (not yet implemented) attach via FK without transferring ownership of the parent:

```text
Vendor                          (global master aggregate)
Vendor Work Order               (links Cost Item ↔ Vendor)
Transaction                     (ledger; may reference Event / Cost Item / VWO / Invoice)
Cost Allocation                 (child of Transaction)
Client Invoice                  (owned by Client/Event commercial billing)
```

### Rules

1. **Repositories never mutate another aggregate.** They may read across aggregates for lookups/counts (e.g. `count_non_archived_by_category`) when the owning service needs that data.
2. **Cross-aggregate operations are orchestrated in services** of the aggregate that owns the invariant (e.g. `CostCategoryService.archive` consults Cost Items; `CostItemService` validates category belongs to the same event).
3. **Child entities never expose independent write APIs.** Example: Cost Item Versions are created only by `CostItemService` on commercial changes; clients may `GET .../cost-items/{id}/versions` but must not `POST/PATCH/DELETE` versions directly.
4. **Invariants are enforced by the aggregate root’s service** (state machines, uniqueness within parent, immutability after status transitions, soft-delete guards).
5. **No circular domain dependencies.** A domain may depend on previously implemented domains only through repository query methods or public service methods when orchestration is required (see `docs/domain_template.md` §12).

### Package layout note

`docs/folder_structure.md` groups some entities under the `events` domain package for cohesion of the Event family. Implementation may still use focused packages (e.g. `cost_categories`, `cost_items`) for CRUD cohesion, provided ownership and FK relationships above are preserved. Data ownership follows this ADR; package layout follows ADR 0006 + the domain template unless a newer ADR says otherwise.

## Consequences

- **Positive:** Clear guidance for Vendor Work Orders (must not “own” Cost Items; only reference them) and Transactions (append-only ledger, no rewriting Cost Item history outside CostItemVersion rules).
- **Positive:** Prevents independent Version/Allocation write endpoints that bypass aggregate invariants.
- **Trade-off:** Some list/read endpoints remain resource-oriented (`/cost-categories`, `/cost-items`) while write semantics stay aggregate-owned — this is intentional.
