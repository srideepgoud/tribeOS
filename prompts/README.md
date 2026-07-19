# Prompts

Reusable prompt templates for working on TribeOS with AI assistants (Cursor, Claude, etc.).

## How to use

- Start **every** new chat by pasting [`00_project_context.md`](./00_project_context.md). It anchors the AI to the authoritative documents and architecture.
- Then paste the task-specific template for what you're doing, and fill in the specifics.

## Templates

| File | Use for |
| --- | --- |
| `00_project_context.md` | Baseline context — paste at the start of every chat |
| `01_backend_feature.md` | Implementing a backend feature (models → repo → service → API) |
| `02_frontend_feature.md` | Implementing a frontend feature |
| `03_fullstack_feature.md` | End-to-end feature across all layers |
| `04_code_review.md` | Staff-engineer-style code review |
| `05_bug_fix.md` | Systematic root-cause bug investigation |
| `06_refactor.md` | Behavior-preserving refactor |
| `07_database_change.md` | Schema change with Alembic migration |
| `08_api_design.md` | Designing REST endpoints |
| `09_ui_component.md` | Building a reusable UI component |
| `10_test_generation.md` | Generating tests |
| `11_release_checklist.md` | Pre-merge verification |
| `12_implementation_plan.md` | Milestone planning before any code (plan → approve → build) |

## Domain blueprint

After Clients and Events, the reusable implementation pattern lives in
[`docs/domain_template.md`](../docs/domain_template.md) (**Approved v1.0**).
Use it together with the fullstack / backend / frontend prompts when adding a new domain.
