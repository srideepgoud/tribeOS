# TribeOS Project Context

You are working on TribeOS, an internal ERP platform for Tribe, a Hyderabad-based event management company.

Before making any changes, treat the following documents as the single source of truth:

- AI_CONTEXT.md
- ARCHITECTURE.md
- docs/domain_model.md
- docs/db_schema.md
- docs/business_rules.md
- docs/state_machine.md
- docs/folder_structure.md
- docs/api_contract.md
- docs/design_system.md
- docs/design_tokens.md

Do not invent business rules.

Do not invent database tables.

Do not rename business entities.

Always follow the layered architecture:

```
Router
→ Service
→ Repository
→ Database
```

Business logic belongs only in Services.

Use:

- FastAPI
- SQLAlchemy 2.0 Async
- Alembic
- PostgreSQL (Supabase)
- Next.js App Router
- TypeScript
- Tailwind
- shadcn/ui
- React Query
- React Hook Form
- Zod

All generated code must be production-ready.
