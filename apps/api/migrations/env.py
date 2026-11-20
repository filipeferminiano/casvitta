from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401 - registers every model on Base.metadata
from app.core.db import Base, engine_options, use_schema
from app.core.settings import get_settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _url() -> str:
    return config.get_main_option("sqlalchemy.url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(), target_metadata=target_metadata, literal_binds=True, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection: Connection) -> None:
    schema = get_settings().database_schema
    connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
    connection.commit()
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        version_table_schema=schema,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    settings = get_settings()
    engine = create_async_engine(_url(), **engine_options(settings))
    use_schema(engine, settings.database_schema)
    async with engine.connect() as connection:
        await connection.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
