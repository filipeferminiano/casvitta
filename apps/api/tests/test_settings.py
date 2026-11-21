from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import Base, engine_options
from app.core.settings import Settings, get_settings


@pytest.mark.parametrize(
    "raw",
    [
        "postgresql://user:pw@db.example.com:5432/postgres",
        "postgres://user:pw@db.example.com:5432/postgres",
        "postgresql+asyncpg://user:pw@db.example.com:5432/postgres",
    ],
)
def test_database_url_is_normalized_to_asyncpg(raw: str) -> None:
    settings = Settings(database_url=raw)
    assert settings.database_url == "postgresql+asyncpg://user:pw@db.example.com:5432/postgres"


def test_ssl_is_required_only_when_configured() -> None:
    assert "connect_args" not in engine_options(Settings())
    options = engine_options(Settings(database_ssl_require=True))
    assert options["connect_args"] == {"ssl": "require"}


def test_schema_name_is_validated() -> None:
    with pytest.raises(ValueError, match="database_schema"):
        Settings(database_schema='casvitta"; drop table x; --')


async def test_tables_live_in_the_configured_schema(session: AsyncSession) -> None:
    """The Supabase project is shared: nothing of ours may land in public."""
    schema = get_settings().database_schema
    assert await session.scalar(text("select current_schema()")) == schema
    in_schema = await session.scalar(
        text("select count(*) from information_schema.tables where table_schema = :s"),
        {"s": schema},
    )
    assert in_schema >= len(Base.metadata.tables)


def test_dev_outbox_is_refused_in_production() -> None:
    import pytest  # noqa: PLC0415
    from pydantic import ValidationError  # noqa: PLC0415

    from app.core.settings import Settings  # noqa: PLC0415

    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="x" * 40, dev_outbox_enabled=True)


async def test_dev_outbox_is_404_unless_enabled(client) -> None:  # type: ignore[no-untyped-def]
    assert (await client.get("/v1/dev/outbox")).status_code == 404
