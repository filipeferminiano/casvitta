from __future__ import annotations

import os

os.environ["APP_ENV"] = "test"
os.environ.setdefault("FAKE_INTEGRATIONS", "true")

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    create_async_engine,
)

import app.models  # noqa: F401
import tests.tenancy_probe  # noqa: F401 - registers the probe table
from app.core.db import Base, get_session, use_schema
from app.core.settings import get_settings
from app.integrations.registry import Integrations, fake_integrations
from app.main import create_app


@pytest.fixture(scope="session")
async def engine() -> AsyncIterator[AsyncEngine]:
    settings = get_settings()
    engine = create_async_engine(settings.test_database_url)
    use_schema(engine, settings.database_schema)
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{settings.database_schema}"'))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def connection(engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """One outer transaction per test, rolled back at the end."""
    async with engine.connect() as conn:
        transaction = await conn.begin()
        yield conn
        await transaction.rollback()


@pytest.fixture
def make_session(connection: AsyncConnection):  # type: ignore[no-untyped-def]
    """Factory for sessions sharing the test transaction (savepoints keep them isolated)."""

    def _make() -> AsyncSession:
        return AsyncSession(
            bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )

    return _make


@pytest.fixture
async def session(make_session) -> AsyncIterator[AsyncSession]:  # type: ignore[no-untyped-def]
    async with make_session() as s:
        yield s


@pytest.fixture
def integrations() -> Integrations:
    return fake_integrations()


@pytest.fixture
async def client(session: AsyncSession, integrations: Integrations) -> AsyncIterator[AsyncClient]:
    app = create_app(integrations=integrations)

    async def _session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _session
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
