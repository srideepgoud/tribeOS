# TribeOS Document Hierarchy

**Status:** Approved v1.0

**Purpose:** Defines the precedence order of TribeOS documents. When two documents conflict, the one higher in this hierarchy wins. This removes ambiguity for both humans and AI assistants about which document is authoritative.

---

## Precedence Order

### Tier 1 — Authoritative (highest authority)

Decisions and specifications. These define *what is true* about the system.

1. **ADRs** (`docs/adr/*`) — recorded architectural decisions; a newer ADR supersedes an older one.
2. `docs/domain_model.md` — business language and entities
3. `docs/db_schema.md` — database schema
4. `docs/business_rules.md` — business validation and invariants
5. `docs/state_machine.md` — entity lifecycles and transitions
6. `docs/api_contract.md` — API conventions
7. `docs/folder_structure.md` — code organization
8. `docs/design_system.md` — UI visual language
9. `docs/design_tokens.md` — semantic design tokens
10. `docs/dependency_policy.md` — approved languages, versions, and dependency rules

### Tier 2 — Implementation Guidance

These interpret and apply Tier 1. If they conflict with Tier 1, Tier 1 wins.

- `AI_CONTEXT.md`
- `ARCHITECTURE.md`
- `.cursorrules`
- `.cursor/rules/*`
- `prompts/*`

### Tier 3 — External implementation guidance (lowest authority)

Third-party guidance for using external platforms. Applies only to platform-specific implementation details; it never defines TribeOS architecture. If it conflicts with Tier 1 or Tier 2, the higher tier wins.

- **Supabase Agent Skills** — Supabase-specific implementation details only (client usage, Storage APIs, connection patterns). See ADR 0005. Must not override architecture, folder structure, domain model, business rules, API design, terminology, or milestone scope, and must not introduce deferred capabilities (Auth, Storage) ahead of their milestone.

---

## Rules

1. Higher tier always wins. Within Tier 1, lower list number = higher authority.
2. A conflict is resolved by conforming to the higher-authority document, **not** by editing it casually.
3. If the higher-authority document is genuinely wrong, change it deliberately — via an ADR where the change is architectural.
4. ADRs are the ultimate tie-breaker: a decision recorded in an ADR overrides any other document until superseded by a newer ADR.
5. Tier 3 external guidance is advisory for platform-specific implementation only; it is subordinate to all TribeOS documents.

---

## Freeze Status

All Tier 1 and Tier 2 documents are **frozen** as of v1.0. Do not modify them unless explicitly instructed. Implementation must conform to these documents rather than changing them. Changes require an explicit instruction and, for architectural changes, a new ADR.
