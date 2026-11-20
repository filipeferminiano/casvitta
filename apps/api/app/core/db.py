"""Async SQLAlchemy engine, session factory and declarative base."""

from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

from sqlalchemy import MetaData, event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.settings import Settings, get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def engine_options(settings: Settings) -> dict[str, Any]:
    """Connection options shared by the app engine and Alembic."""
    options: dict[str, Any] = {"pool_pre_ping": True}
    if settings.database_ssl_require:
        options["connect_args"] = {"ssl": "require"}
    return options


def use_schema(engine: AsyncEngine, schema: str) -> None:
    """Every new connection works inside `schema`: unqualified tables resolve there.

    Set in autocommit so the pool's rollback on checkin cannot undo it. `extensions` is where
    Supabase installs extensions (ignored when it does not exist, e.g. locally).
    """

    @event.listens_for(engine.sync_engine, "connect", insert=True)
    def _set_search_path(dbapi_connection: Any, _record: Any) -> None:
        autocommit = dbapi_connection.autocommit
        dbapi_connection.autocommit = True
        cursor = dbapi_connection.cursor()
        cursor.execute(f'SET SESSION search_path TO "{schema}", extensions')
        cursor.close()
        dbapi_connection.autocommit = autocommit


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    engine = create_async_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        **engine_options(settings),
    )
    use_schema(engine, settings.database_schema)
    return engine


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    async with get_sessionmaker()() as session:
        yield session
