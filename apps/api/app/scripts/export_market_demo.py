"""Exports the fabricated market pages (demo seed) as JSON for the web app's mock mode.

    uv run python -m app.scripts.export_market_demo

Seeds the demo inside a transaction on TEST_DATABASE_URL, renders every page payload through the
real service (gated and rounded), writes apps/web/src/mocks/market-demo.json and rolls back.
"""

from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

import app.models  # noqa: F401 - registers every table
from app.core.db import Base, use_schema
from app.core.settings import REPO_ROOT, get_settings
from app.domains.market_data import service, tools
from app.domains.market_data.gates import Gates
from app.domains.market_data.models import MarketBuilding, MarketNeighborhood, MarketStreet
from app.scripts.seed_market_demo import seed_demo

CITY = "sao-paulo"
OUTPUT = REPO_ROOT / "apps" / "web" / "src" / "mocks" / "market-demo.json"


async def export(session: AsyncSession) -> dict[str, object]:
    settings = get_settings()
    gates = Gates.from_settings(settings)
    await seed_demo(session)
    pages: dict[str, object] = {}

    def put(key: str, value: object) -> None:
        if value is not None:
            pages[key] = json.loads(value.model_dump_json())  # type: ignore[attr-defined]

    put(f"{CITY}", await service.city_index(session, CITY, gates))
    neighborhoods = (await session.scalars(select(MarketNeighborhood))).all()
    by_id = {n.id: n for n in neighborhoods}
    for n in neighborhoods:
        put(f"{CITY}/{n.slug}", await service.neighborhood_page(session, CITY, n.slug, gates))
        put(
            f"{CITY}/{n.slug}/financing",
            await service.financing_page(session, CITY, n.slug, gates, settings),
        )
    for street in (await session.scalars(select(MarketStreet))).all():
        parent = by_id[street.neighborhood_id]
        put(
            f"{CITY}/{parent.slug}/streets/{street.slug}",
            await service.street_page(session, CITY, parent.slug, street.slug, gates),
        )
    for building in (await session.scalars(select(MarketBuilding))).all():
        parent = by_id[building.neighborhood_id]
        put(
            f"{CITY}/{parent.slug}/buildings/{building.slug}",
            await service.building_page(session, CITY, parent.slug, building.slug, gates),
        )
    for template in sorted(service.SITEMAP_TEMPLATES):
        put(f"{CITY}/sitemaps/{template}", await service.sitemap(session, CITY, template, gates))
    put(f"{CITY}/itbi", await tools.itbi_page(session, CITY, gates, settings))
    return pages


async def main() -> int:
    settings = get_settings()
    engine = create_async_engine(settings.test_database_url)
    use_schema(engine, settings.database_schema)
    async with engine.connect() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{settings.database_schema}"'))
        await conn.run_sync(Base.metadata.create_all)
        await conn.commit()
        transaction = await conn.begin()
        async with AsyncSession(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        ) as session:
            pages = await export(session)
        await transaction.rollback()
    await engine.dispose()
    OUTPUT.write_text(json.dumps(pages, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {len(pages)} demo payloads to {OUTPUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
