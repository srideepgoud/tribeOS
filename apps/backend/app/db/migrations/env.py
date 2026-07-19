"""Alembic migration environment (async).

The database URL is resolved from application settings rather than
``alembic.ini`` so secrets never live in configuration files.
"""

from __future__ import annotations

import asyncio
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db.base import Base

# Domain models must be imported here so Alembic autogenerate sees their tables.
from app.domains.clients import models as _clients_models  # noqa: F401
from app.domains.cost_categories import models as _cost_categories_models  # noqa: F401
from app.domains.cost_items import models as _cost_items_models  # noqa: F401
from app.domains.events import models as _events_models  # noqa: F401
from app.domains.vendors import models as _vendors_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The URL is read directly from settings (never written into the ini config,
# which would otherwise mangle '%' characters via ConfigParser interpolation).
target_metadata = Base.metadata


def get_url() -> str:
    return get_settings().database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a DB connection)."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode using an async engine."""
    connectable = create_async_engine(get_url(), poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    # asyncpg requires the selector event loop on Windows.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_migrations_online())
