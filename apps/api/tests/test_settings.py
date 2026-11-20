from __future__ import annotations

import pytest

from app.core.db import engine_options
from app.core.settings import Settings


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
