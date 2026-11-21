"""After an ITBI refresh: tell search engines which indexable pages changed, and refresh the web.

A page "changed" when any published number of its entity changed (sales count, median value or
median price per m² in any kind or window), compared with the snapshot taken before the run.
Monthly refreshes move the rolling windows, so most pages change then.
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.settings import Settings
from app.domains.market_data import service
from app.domains.market_data.gates import Gates
from app.domains.market_data.models import (
    MarketBuilding,
    MarketCity,
    MarketNeighborhood,
    MarketStats,
    MarketStreet,
    StatsEntity,
)
from app.domains.seo.service import submit_urls
from app.integrations.search_index.port import SearchIndexPort

log = get_logger(__name__)

Signature = dict[uuid.UUID, frozenset[tuple[Any, ...]]]


async def snapshot(session: AsyncSession, city_id: uuid.UUID) -> Signature:
    rows = await session.execute(
        select(
            MarketStats.entity_id,
            MarketStats.kind,
            MarketStats.window,
            MarketStats.window_end,
            MarketStats.tx_count,
            MarketStats.median_value_cents,
            MarketStats.median_price_m2_cents,
        ).where(MarketStats.city_id == city_id)
    )
    out: dict[uuid.UUID, set[tuple[Any, ...]]] = {}
    for entity_id, *rest in rows:
        out.setdefault(entity_id, set()).add(tuple(rest))
    return {k: frozenset(v) for k, v in out.items()}


def changed(before: Signature, after: Signature) -> set[uuid.UUID]:
    return {k for k in before.keys() | after.keys() if before.get(k) != after.get(k)}


async def indexable_paths(
    session: AsyncSession, city: MarketCity, gates: Gates
) -> list[tuple[uuid.UUID, str]]:
    """(entity id, site path) of every indexable price page (the sitemaps' content)."""
    out: list[tuple[uuid.UUID, str]] = []

    def gate_join(entity: StatsEntity, column: Any, window: str) -> Any:
        return and_(
            MarketStats.entity_id == column,
            MarketStats.entity_type == entity,
            MarketStats.kind == "all",
            MarketStats.window == window,
        )

    neighborhoods = await session.execute(
        select(MarketNeighborhood.id, MarketNeighborhood.slug)
        .join(MarketStats, gate_join(StatsEntity.NEIGHBORHOOD, MarketNeighborhood.id, "last_12m"))
        .where(
            MarketNeighborhood.city_id == city.id,
            MarketNeighborhood.is_indexable,
            MarketStats.median_sample >= gates.neighborhood_12m,
        )
    )
    for nid, slug in neighborhoods:
        out.append((nid, service.neighborhood_path(city.slug, slug)))
        out.append((nid, service.financing_path(city.slug, slug)))
    streets = await session.execute(
        select(MarketStreet.id, MarketStreet.slug, MarketNeighborhood.slug)
        .join(MarketNeighborhood, MarketNeighborhood.id == MarketStreet.neighborhood_id)
        .join(MarketStats, gate_join(StatsEntity.STREET, MarketStreet.id, "last_36m"))
        .where(
            MarketStreet.city_id == city.id,
            MarketNeighborhood.is_indexable,
            MarketStats.median_sample >= gates.street_36m,
        )
    )
    out += [(sid, service.street_path(city.slug, n, s)) for sid, s, n in streets]
    buildings = await session.execute(
        select(MarketBuilding.id, MarketBuilding.slug, MarketNeighborhood.slug)
        .join(MarketNeighborhood, MarketNeighborhood.id == MarketBuilding.neighborhood_id)
        .join(MarketStats, gate_join(StatsEntity.BUILDING, MarketBuilding.id, "all"))
        .where(
            MarketBuilding.city_id == city.id,
            MarketNeighborhood.is_indexable,
            MarketStats.median_sample >= gates.building_all,
        )
    )
    out += [(bid, service.building_path(city.slug, n, b)) for bid, b, n in buildings]
    return out


async def after_refresh(  # noqa: PLR0917
    session: AsyncSession,
    city: MarketCity,
    before: Signature,
    settings: Settings,
    search_index: SearchIndexPort,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    """Submit changed indexable pages to IndexNow and revalidate the web cache."""
    after = await snapshot(session, city.id)
    touched = changed(before, after)
    pages = await indexable_paths(session, city, Gates.from_settings(settings))
    paths = sorted({path for entity_id, path in pages if entity_id in touched})
    if touched:
        paths.insert(0, service.city_path(city.slug))
    origin = settings.site_url.rstrip("/")
    result = await submit_urls(
        search_index, [f"{origin}{p}" for p in paths], settings.indexnow_root_domain
    )
    revalidated = await revalidate_web(settings, transport)
    summary = {
        "changed_entities": len(touched),
        "changed_indexable_pages": len(paths),
        "indexnow_submitted": result.submitted,
        "web_revalidated": revalidated,
    }
    log.info("itbi_after_refresh", **summary)
    return summary


async def revalidate_web(
    settings: Settings, transport: httpx.AsyncBaseTransport | None = None
) -> bool:
    """POST the web's /api/revalidate (our own service; skipped when not configured)."""
    if not settings.web_revalidate_url or not settings.web_revalidate_secret:
        return False
    secret = settings.web_revalidate_secret.get_secret_value()
    async with httpx.AsyncClient(transport=transport, timeout=15) as client:
        response = await client.post(
            settings.web_revalidate_url, headers={"Authorization": f"Bearer {secret}"}
        )
    if response.status_code != 200:
        log.warning("web_revalidate_failed", status=response.status_code)
        return False
    return True
