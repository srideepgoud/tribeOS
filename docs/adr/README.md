# Architecture Decision Records (ADR)

This directory holds Architecture Decision Records — short documents capturing significant, hard-to-reverse technical decisions.

## Format

Each ADR is `NNNN-short-title.md` and contains:

- **Status:** Proposed | Accepted | Superseded
- **Context:** the forces and constraints at play
- **Decision:** what was chosen
- **Consequences:** trade-offs and follow-on effects

ADRs are immutable once accepted. To change a decision, add a new ADR that supersedes the previous one.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](./0002-domain-first-backend-structure.md) | Domain-first backend structure | Accepted |
| [0003](./0003-supabase-primary-dev-database.md) | Supabase as primary development database | Accepted |
| [0004](./0004-supabase-development-environment.md) | Supabase development environment | Accepted |
| [0005](./0005-supabase-agent-skills.md) | Supabase Agent Skills as Tier-3 guidance | Accepted |
| [0006](./0006-domain-module-file-convention.md) | Domain module file naming convention | Accepted |
| [0007](./0007-validation-responsibilities.md) | Validation responsibilities across layers | Accepted |
| [0008](./0008-materialized-financial-values.md) | Materialized financial values on Cost Items | Accepted (partially superseded by 0012) |
| [0009](./0009-aggregate-ownership.md) | Aggregate ownership boundaries | Accepted |
| [0010](./0010-cross-aggregate-validation.md) | Cross-aggregate validation | Accepted |
| [0011](./0011-transaction-financial-immutability.md) | Transaction financial immutability & Phase 7 scope | Accepted (partially superseded by 0012) |
| [0012](./0012-financial-posting-and-attribution-lifecycle.md) | Financial posting and attribution lifecycle | Accepted |
| [0013](./0013-client-invoice-and-receipt-lifecycle.md) | Client Invoice and Receipt lifecycle | Accepted |
