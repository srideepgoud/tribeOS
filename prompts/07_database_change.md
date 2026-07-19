# Database Change

We need to change the database schema.

Before making changes:

- Compare with db_schema.md.
- Explain why the change is needed.
- Identify affected entities.
- Generate Alembic migration.
- Update SQLAlchemy models.
- Check repository impacts.
- Check service impacts.
- Check API impacts.
- Identify backward compatibility concerns.

Never modify the schema without a migration.

Never edit the schema through the Supabase dashboard — all changes go through Alembic.
