# ADR 0010: Cross-Aggregate Validation

**Status:** Accepted  
**Date:** 2026-07-20  
**Related:** ADR 0007 (validation responsibilities); ADR 0009 (aggregate ownership); ADR 0011 (transaction financial immutability); ADR 0012 (financial posting and attribution); ADR 0013 (Client Invoice and Receipt lifecycle); `docs/domain_template.md` §5–6, §12; `docs/business_rules.md`; `docs/state_machine.md`

## Context

Through Clients → Events → Cost Categories → Cost Items → Vendors → Vendor Work Orders, TribeOS has repeatedly used the same cross-aggregate validation pattern:

- existence and archive checks via foreign repositories
- ownership / type consistency in the owning service
- business invariants (`ConflictError`) and lifecycle rules (`InvalidStateError`)

Finance domains (Transactions, Cost Allocations, Client Invoices) will intensify this pattern. Without an explicit rulebook, contributors may invent inconsistent check order, put orchestration in repositories, or map overlapping failures to different HTTP codes.

ADR 0009 defines **who owns what**. This ADR defines **how ownership is respected during validation and orchestration**.

## Decision

### 1. Purpose

Define how aggregates interact without violating aggregate ownership: validation order, repository vs service responsibilities, and failure precedence for orchestration-heavy domains.

### 2. Validation order

When a service mutates an aggregate that depends on other aggregates, perform checks in this order and **stop at the first failure**:

```text
1. Existence
       ↓
2. Archive state
       ↓
3. Ownership consistency
       ↓
4. Cross-aggregate invariant
       ↓
5. State machine
       ↓
6. Persistence
```

| Step | Meaning | Typical error |
|------|---------|---------------|
| 1. Existence | Referenced aggregate row must exist | `NotFoundError` |
| 2. Archive state | Referenced aggregate must not be soft-archived (where archive applies) | `NotFoundError` (treat archived as missing for standard reads) or `ConflictError` when the rule is “blocked by dependents” |
| 3. Ownership consistency | FKs belong together (e.g. category.event_id == cost_item.event_id; expense type allows VWO) | `DomainValidationError` |
| 4. Cross-aggregate invariant | Business cardinality / guards (e.g. one active VWO; archive blocked by children) | `ConflictError` |
| 5. State machine | Legal transitions; commercial / field locks | `InvalidStateError` |
| 6. Persistence | Flush / commit after all rules pass | — |

This order already matches Clients, Events, Cost Items, and Vendor Work Orders. New domains must follow it unless a newer ADR supersedes this one.

### 3. Repository rules

Repositories **may**:

- read another aggregate’s table for lookups
- expose existence / count / filtered query helpers (e.g. `count_active_by_vendor`, `get_by_id`)

Repositories **may never**:

- mutate another aggregate
- coordinate multi-aggregate workflows
- encode business workflows or state machines
- choose HTTP status codes or API envelopes

### 4. Service rules

Only **services** may orchestrate across aggregates, for example:

- Vendor ↔ Vendor Work Order (archive guard, create-time vendor check)
- Cost Item ↔ Transaction (actuals materialization — finance phases)
- Client Invoice ↔ Transaction (receipt linkage — ADR 0013)
- Event ↔ Settlement side effects (Event status owns settlement — later phases)

The service that **owns the invariant** performs the check (ADR 0009). Child write APIs remain forbidden; side effects on foreign aggregates use that aggregate’s repository write methods only when the owning service explicitly updates a field it is allowed to maintain (e.g. system-maintained `actual_amount` per ADR 0008).

### 5. Failure precedence

When multiple validations would fail, report **only the earliest** in this precedence (aligned with the validation order):

1. `NOT_FOUND` (`NotFoundError`) — missing or archived-as-missing references  
2. `CONFLICT` (`ConflictError`) — uniqueness, cardinality, archive blocked by dependents  
3. `INVALID_STATE` (`InvalidStateError`) — illegal transition or immutability  
4. `VALIDATION_ERROR` (`DomainValidationError`) — business field / ownership rules beyond transport validation  

Pydantic / transport validation still runs at the API boundary **before** service orchestration (ADR 0007) and is outside this precedence.

### 6. Documentation gate (Finance Foundation onward)

No new implementation phase begins until documentation conflicts for that domain are resolved and explicitly recorded (locked decisions and/or ADRs). Implementation must conform to Tier 1 docs and accepted ADRs rather than inventing policy.

## Consequences

- **Positive:** Transactions and later finance modules inherit a single orchestration playbook instead of re-deriving check order.
- **Positive:** Consistent API error codes across domains for the same class of failure.
- **Positive:** Reinforces ADR 0009: repositories stay persistence-only; services own workflows.
- **Trade-off:** Strict stop-at-first-failure means clients see one error at a time; that is intentional for predictability.
- **Trade-off:** Archive-as-missing vs explicit “cannot archive” conflicts remain domain-specific at step 2 vs 4; services must choose the documented rule for that entity, not invent a third pattern.
