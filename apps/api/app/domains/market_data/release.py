"""Release a wave of curated neighborhoods to search engines.

Ingestion never flips ``is_indexable`` on an existing neighborhood (a person decides). This is
that decision, made explicit: the seeds of one wave get their curated name, preposition and zone,
become indexable (with their streets and buildings that pass the gates), and their pages are sent
to IndexNow; the web cache is revalidated.
"""

from __future__ import annotations

from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.settings import Settings
from app.domains.market_data import service
from app.domains.market_data.gates import Gates
from app.domains.market_data.models import MarketCity, MarketNeighborhood
from app.domains.market_data.refresh import indexable_paths, revalidate_web
from app.domains.market_data.seeds import SEEDS, guess_preposition
from app.domains.seo.service import submit_urls
from app.integrations.search_index.port import SearchIndexPort

log = get_logger(__name__)


def _neighborhood_of(path: str) -> str | None:
    parts = path.split("/")
    return parts[3] if len(parts) > 3 else None


async def release_wave(  # noqa: PLR0917
    session: AsyncSession,
    city_slug: str,
    wave: int,
    settings: Settings,
    search_index: SearchIndexPort,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    city = await session.scalar(select(MarketCity).where(MarketCity.slug == city_slug))
    if city is None:
        raise AppError("not_found", status_code=404)
    seeds = [s for s in SEEDS.get(city_slug, ()) if s.wave == wave]
    rows = {
        n.slug: n
        for n in await session.scalars(
            select(MarketNeighborhood).where(
                MarketNeighborhood.city_id == city.id,
                MarketNeighborhood.slug.in_([s.slug for s in seeds]),
            )
        )
    }
    released: list[str] = []
    already: list[str] = []
    missing: list[str] = []
    for seed in seeds:
        neighborhood = rows.get(seed.slug)
        if neighborhood is None:  # not in the data (yet): nothing to publish
            missing.append(seed.slug)
            continue
        neighborhood.name = seed.name
        neighborhood.preposition = seed.preposition or guess_preposition(seed.name)
        neighborhood.zone = seed.zone
        neighborhood.wave = seed.wave
        neighborhood.is_auto = False
        (already if neighborhood.is_indexable else released).append(seed.slug)
        neighborhood.is_indexable = True
    await session.flush()

    # Every indexable page of the newly released neighborhoods: /<template>/<city>/<bairro>/...
    new = set(released)
    pages = await indexable_paths(session, city, Gates.from_settings(settings))
    paths = sorted({path for _, path in pages if _neighborhood_of(path) in new})
    if paths:
        paths.insert(0, service.city_path(city.slug))
    origin = settings.site_url.rstrip("/")
    result = await submit_urls(
        search_index, [f"{origin}{p}" for p in paths], settings.indexnow_root_domain
    )
    summary = {
        "wave": wave,
        "released": released,
        "already_indexable": already,
        "missing_in_data": missing,
        "pages": len(paths),
        "indexnow_submitted": result.submitted,
        "web_revalidated": await revalidate_web(settings, transport),
    }
    log.info("market_wave_released", **summary)
    return summary
