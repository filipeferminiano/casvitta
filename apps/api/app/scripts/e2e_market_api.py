"""API for the Playwright price-pages flow: a separate database with the fabricated demo.

    uv run python -m app.scripts.e2e_market_api --port 8100

Uses E2E_DATABASE_URL, or TEST_DATABASE_URL with the database renamed to casvitta_e2e (created
when missing), so it never collides with pytest. Tables are recreated, the demo seeded, then
uvicorn serves the app. Dev/test only (needs openpyxl).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine


def e2e_database_url() -> str:
    if url := os.environ.get("E2E_DATABASE_URL"):
        return url
    from app.core.settings import get_settings  # noqa: PLC0415

    return (
        make_url(get_settings().test_database_url)
        .set(database="casvitta_e2e")
        .render_as_string(hide_password=False)
    )


async def prepare(url: str) -> None:
    from sqlalchemy import text  # noqa: PLC0415

    import app.models  # noqa: F401, PLC0415 - registers every table
    from app.core.db import Base, get_sessionmaker, use_schema  # noqa: PLC0415
    from app.core.settings import get_settings  # noqa: PLC0415
    from app.scripts.seed_market_demo import seed_demo  # noqa: PLC0415

    target = make_url(url)
    admin = create_async_engine(
        target.set(database="postgres").render_as_string(hide_password=False),
        isolation_level="AUTOCOMMIT",
    )
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    await admin.dispose()

    schema = get_settings().database_schema
    engine = create_async_engine(url)
    use_schema(engine, schema)
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    async with get_sessionmaker()() as session:
        await seed_demo(session)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    args = parser.parse_args()
    url = e2e_database_url()
    os.environ["DATABASE_URL"] = url  # before the app reads its settings
    os.environ.setdefault("ADMIN_TOKEN", "e2e-admin-token")
    os.environ.setdefault("FAKE_INTEGRATIONS", "true")
    from app.core.settings import get_settings  # noqa: PLC0415

    get_settings.cache_clear()  # settings were read above with the default database
    if get_settings().database_url != url:
        sys.exit("e2e: refusing to run against a database other than the e2e one")
    asyncio.run(prepare(url))
    from app.core.db import get_engine, get_sessionmaker  # noqa: PLC0415

    # The engine was bound to the setup event loop; uvicorn runs its own.
    get_sessionmaker.cache_clear()
    get_engine.cache_clear()

    import uvicorn  # noqa: PLC0415

    from app.main import create_app  # noqa: PLC0415

    uvicorn.run(create_app(), host="127.0.0.1", port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
