"""Read side of the public price pages. Every number goes through gates.Gates.publish."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import and_, func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.finance import AmortizationSystem, FinancingInputError, simulate
from app.core.settings import Settings
from app.domains.market_data.gates import Gates
from app.domains.market_data.models import (
    ItbiIngestionRun,
    ItbiTransaction,
    MarketBuilding,
    MarketCity,
    MarketMonthly,
    MarketNeighborhood,
    MarketNeighborhoodAdjacency,
    MarketSlugRedirect,
    MarketStats,
    MarketStreet,
    RunStatus,
    SlugEntity,
    StatsEntity,
)
from app.domains.market_data.schemas import (
    AreaBand,
    BuildingPage,
    BuildingRow,
    CityIndexPage,
    FinancedYear,
    FinancingContext,
    FinancingPage,
    GateInfo,
    MonthlyPoint,
    NeighborhoodPage,
    NeighborhoodRow,
    NeighborIncome,
    PlaceRef,
    PriceComparison,
    PublicStats,
    Redirect,
    Simulation,
    Sitemap,
    SitemapEntry,
    SourceInfo,
    StreetPage,
    StreetRow,
    YearCount,
)

TOP_LIMIT = 10
FIRST_YEAR = 2019


# --- paths ------------------------------------------------------------------------------------


def city_path(city: str) -> str:
    return f"/preco-m2/{city}"


def neighborhood_path(city: str, neighborhood: str) -> str:
    return f"/preco-m2/{city}/{neighborhood}"


def street_path(city: str, neighborhood: str, street: str) -> str:
    """Street pages live under /rua (SEO-3); the old /preco-m2/.../{rua} URLs 301 here."""
    return f"/rua/{city}/{neighborhood}/{street}"


def building_path(city: str, neighborhood: str, building: str) -> str:
    return f"/condominio/{city}/{neighborhood}/{building}"


def financing_path(city: str, neighborhood: str) -> str:
    return f"/financiamento/{city}/{neighborhood}"


def valuation_path(city: str, neighborhood: str) -> str:
    return f"/quanto-vale-meu-imovel/{city}/{neighborhood}"


SITEMAP_TEMPLATES = frozenset(
    {"bairros", "ruas", "condominios", "financiamento", "avaliacao", "itbi", "imoveis"}
)


# --- lookups ----------------------------------------------------------------------------------


async def _city(session: AsyncSession, slug: str) -> MarketCity | None:
    return await session.scalar(select(MarketCity).where(MarketCity.slug == slug))


async def source_info(session: AsyncSession, city: MarketCity) -> SourceInfo:
    run = await session.scalar(
        select(ItbiIngestionRun)
        .where(ItbiIngestionRun.city_id == city.id, ItbiIngestionRun.status == RunStatus.SUCCEEDED)
        .order_by(ItbiIngestionRun.finished_at.desc())
        .limit(1)
    )
    if run is None:
        return SourceInfo(
            refreshed_at=None, data_through=None, window_end=None, is_demo=city.is_demo
        )
    end = run.report.get("window_end")
    return SourceInfo(
        refreshed_at=run.finished_at,
        data_through=run.data_through,
        window_end=date.fromisoformat(end) if end else None,
        is_demo=city.is_demo,
    )


async def _stats(
    session: AsyncSession,
    entity: StatsEntity,
    ids: Sequence[uuid.UUID],
    kind: str,
    window: str,
) -> dict[uuid.UUID, MarketStats]:
    if not ids:
        return {}
    rows = await session.scalars(
        select(MarketStats).where(
            MarketStats.entity_type == entity,
            MarketStats.entity_id.in_(ids),
            MarketStats.kind == kind,
            MarketStats.window == window,
        )
    )
    return {r.entity_id: r for r in rows}


async def _one(
    session: AsyncSession, entity: StatsEntity, entity_id: uuid.UUID, kind: str, window: str
) -> MarketStats | None:
    return (await _stats(session, entity, [entity_id], kind, window)).get(entity_id)


async def _neighborhood(
    session: AsyncSession, city: MarketCity, slug: str
) -> MarketNeighborhood | Redirect | None:
    found = await session.scalar(
        select(MarketNeighborhood).where(
            MarketNeighborhood.city_id == city.id, MarketNeighborhood.slug == slug
        )
    )
    if found:
        return found
    target = await _redirect_target(session, SlugEntity.NEIGHBORHOOD, city.id, slug)
    if isinstance(target, MarketNeighborhood):
        return Redirect(path=neighborhood_path(city.slug, target.slug))
    return None


async def _redirect_target(
    session: AsyncSession, entity: SlugEntity, parent_id: uuid.UUID, old_slug: str
) -> MarketNeighborhood | MarketStreet | MarketBuilding | None:
    redirect = await session.scalar(
        select(MarketSlugRedirect).where(
            MarketSlugRedirect.entity_type == entity,
            MarketSlugRedirect.parent_id == parent_id,
            MarketSlugRedirect.old_slug == old_slug,
        )
    )
    if redirect is None:
        return None
    if entity is SlugEntity.NEIGHBORHOOD:
        return await session.get(MarketNeighborhood, redirect.entity_id)
    if entity is SlugEntity.STREET:
        return await session.get(MarketStreet, redirect.entity_id)
    return await session.get(MarketBuilding, redirect.entity_id)


def _gate(
    gates: Gates, entity: StatsEntity, stats: MarketStats | None, indexable_parent: bool
) -> GateInfo:
    window, minimum = gates.page_threshold(entity)
    passes = gates.page_passes(entity, stats)
    return GateInfo(
        passes=passes, indexable=passes and indexable_parent, min_sales=minimum, window=window
    )


def _place(slug: str, name: str, path: str) -> PlaceRef:
    return PlaceRef(slug=slug, name=name, path=path)


def _neighborhood_ref(city_slug: str, neighborhood: MarketNeighborhood) -> PlaceRef:
    return PlaceRef(
        slug=neighborhood.slug,
        name=neighborhood.name,
        path=neighborhood_path(city_slug, neighborhood.slug),
        in_name=f"{neighborhood.preposition} {neighborhood.name}",
    )


# --- pages ------------------------------------------------------------------------------------


async def city_index(session: AsyncSession, city_slug: str, gates: Gates) -> CityIndexPage | None:
    city = await _city(session, city_slug)
    if city is None:
        return None
    neighborhoods = (
        await session.scalars(
            select(MarketNeighborhood)
            .where(MarketNeighborhood.city_id == city.id)
            .order_by(MarketNeighborhood.name)
        )
    ).all()
    stats = await published_12m(
        session,
        StatsEntity.NEIGHBORHOOD,
        [n.id for n in neighborhoods],
        gates,
        gates.neighborhood_12m,
    )
    rows = []
    for n in neighborhoods:
        public = stats.get(n.id)
        if public is not None and not public.priced:
            public = None
        if public is None and not n.is_indexable:
            continue  # the index lists neighborhoods with numbers, plus curated ones
        rows.append(
            NeighborhoodRow(
                place=_neighborhood_ref(city.slug, n),
                zone=n.zone,
                indexable=n.is_indexable and public is not None,
                stats=public,
            )
        )
    city_stats = (await published_12m(session, StatsEntity.CITY, [city.id], gates, 1)).get(city.id)
    return CityIndexPage(
        city=_place(city.slug, city.name, city_path(city.slug)),
        source=await source_info(session, city),
        stats=city_stats,
        neighborhoods_with_price=sum(1 for r in rows if r.stats),
        neighborhoods=rows,
    )


async def neighborhood_page(
    session: AsyncSession, city_slug: str, slug: str, gates: Gates
) -> NeighborhoodPage | Redirect | None:
    city = await _city(session, city_slug)
    if city is None:
        return None
    neighborhood = await _neighborhood(session, city, slug)
    if neighborhood is None or isinstance(neighborhood, Redirect):
        return neighborhood
    nid = neighborhood.id
    gate_stats = await _one(session, StatsEntity.NEIGHBORHOOD, nid, "all", "last_12m")
    gate = _gate(gates, StatsEntity.NEIGHBORHOOD, gate_stats, neighborhood.is_indexable)
    source = await source_info(session, city)
    city_ref = _place(city.slug, city.name, city_path(city.slug))
    ref = _neighborhood_ref(city.slug, neighborhood)
    page = NeighborhoodPage(
        city=city_ref,
        neighborhood=ref,
        gate=gate,
        source=source,
        stats=None,
        sales_12m=gate_stats.tx_count if gate_stats else 0,
        price_m2_change_5y_pct=None,
        monthly=[],
        area_bands=[],
        top_streets=[],
        top_buildings=[],
        neighbors=await _neighbors(session, city, nid, gates),
        financing=None,
    )
    if not gate.passes:
        return page  # "poucos dados": the count and links only

    page.stats = (await published_12m(session, StatsEntity.NEIGHBORHOOD, [nid], gates, 1)).get(nid)
    five_years_ago = await _one(session, StatsEntity.NEIGHBORHOOD, nid, "all", "y5_12m")
    if gate_stats and five_years_ago and gates.priced(five_years_ago.median_sample):
        page.price_m2_change_5y_pct = change_pct(
            gate_stats.median_price_m2_cents, five_years_ago.median_price_m2_cents
        )
    page.monthly = await _monthly(session, nid, gates)
    apartments_12m = await _one(session, StatsEntity.NEIGHBORHOOD, nid, "apartment", "last_12m")
    page.area_bands = [
        AreaBand(
            band=b["band"],
            min_m2=b["min_m2"],
            max_m2=b["max_m2"],
            sales=b["tx_count"],
            priced=gates.priced(b["median_sample"]),
            median_value_cents=gates.value(b["median_value_cents"])
            if gates.priced(b["median_sample"])
            else None,
            median_price_m2_cents=gates.price_m2(b.get("median_price_m2_cents"))
            if gates.priced(b["median_sample"])
            else None,
        )
        for b in (apartments_12m.area_bands if apartments_12m else [])
    ]
    page.top_streets = await _top_streets(session, city, neighborhood, gates)
    page.top_buildings = await _top_buildings(session, city, neighborhood, gates)
    page.financing = await _financing_context(session, nid, source.window_end, gates)
    return page


async def _neighbors(
    session: AsyncSession, city: MarketCity, neighborhood_id: uuid.UUID, gates: Gates
) -> list[NeighborhoodRow]:
    neighbors = (
        await session.scalars(
            select(MarketNeighborhood)
            .join(
                MarketNeighborhoodAdjacency,
                MarketNeighborhoodAdjacency.neighbor_id == MarketNeighborhood.id,
            )
            .where(MarketNeighborhoodAdjacency.neighborhood_id == neighborhood_id)
            .order_by(MarketNeighborhood.name)
        )
    ).all()
    stats = await published_12m(
        session, StatsEntity.NEIGHBORHOOD, [n.id for n in neighbors], gates, gates.neighborhood_12m
    )
    rows = []
    for n in neighbors:
        public = stats.get(n.id)
        rows.append(
            NeighborhoodRow(
                place=_neighborhood_ref(city.slug, n),
                zone=n.zone,
                indexable=n.is_indexable and public is not None,
                stats=public,
            )
        )
    return rows


async def _monthly(
    session: AsyncSession, neighborhood_id: uuid.UUID, gates: Gates
) -> list[MonthlyPoint]:
    rows = await session.scalars(
        select(MarketMonthly)
        .where(MarketMonthly.neighborhood_id == neighborhood_id, MarketMonthly.kind == "all")
        .order_by(MarketMonthly.month)
    )
    return [
        MonthlyPoint(
            month=f"{r.month.year:04d}-{r.month.month:02d}",
            sales=r.tx_count,
            median_price_m2_cents=gates.price_m2(r.median_price_m2_cents)
            if gates.priced(r.median_sample)
            else None,
            rolling_median_price_m2_cents=gates.price_m2(r.rolling_median_price_m2_cents)
            if gates.priced(r.rolling_sample)
            else None,
        )
        for r in rows
    ]


async def _financing_context(
    session: AsyncSession, neighborhood_id: uuid.UUID, end: date | None, gates: Gates
) -> FinancingContext | None:
    if end is None:
        return None
    stats = await _one(session, StatsEntity.NEIGHBORHOOD, neighborhood_id, "all", f"y{end.year}")
    public = gates.publish(stats, gates.neighborhood_12m)
    if public is None or public.financed_pct is None:
        return None
    return FinancingContext(
        year=end.year,
        financed_pct=public.financed_pct,
        median_financed_pct=public.median_financed_pct,
        top_financing_type_code=public.top_financing_type_code,
    )


async def _top_streets(
    session: AsyncSession,
    city: MarketCity,
    neighborhood: MarketNeighborhood,
    gates: Gates,
    *,
    exclude: uuid.UUID | None = None,
    limit: int = TOP_LIMIT,
) -> list[StreetRow]:
    """Streets of the neighborhood with most sales (that pass the street gate), max ``limit``."""
    rows = await session.execute(
        select(MarketStreet, MarketStats)
        .join(
            MarketStats,
            and_(
                MarketStats.entity_id == MarketStreet.id,
                MarketStats.entity_type == StatsEntity.STREET,
                MarketStats.kind == "all",
                MarketStats.window == "last_36m",
            ),
        )
        .where(
            MarketStreet.neighborhood_id == neighborhood.id,
            MarketStats.median_sample >= gates.street_36m,
            MarketStreet.id != exclude if exclude else true(),
        )
        .order_by(MarketStats.tx_count.desc(), MarketStreet.name)
        .limit(limit)
    )
    streets = list(rows)
    last_12m = await _stats(
        session, StatsEntity.STREET, [s.id for s, _ in streets], "all", "last_12m"
    )
    return [
        StreetRow(
            place=_place(
                street.slug, street.name, street_path(city.slug, neighborhood.slug, street.slug)
            ),
            # The table shows the last 12 months; the street qualified on 36 months.
            stats=gates.publish(last_12m.get(street.id), 1),
        )
        for street, _ in streets
    ]


async def _buildings(
    session: AsyncSession,
    city: MarketCity,
    neighborhood: MarketNeighborhood,
    gates: Gates,
    *,
    street_id: uuid.UUID | None = None,
    limit: int | None = TOP_LIMIT,
) -> list[BuildingRow]:
    query = (
        select(MarketBuilding, MarketStreet, MarketStats)
        .join(MarketStreet, MarketStreet.id == MarketBuilding.street_id)
        .join(
            MarketStats,
            and_(
                MarketStats.entity_id == MarketBuilding.id,
                MarketStats.entity_type == StatsEntity.BUILDING,
                MarketStats.kind == "all",
                MarketStats.window == "all",
            ),
        )
        .where(
            MarketBuilding.neighborhood_id == neighborhood.id,
            MarketStats.median_sample >= gates.building_all,
        )
        .order_by(MarketStats.tx_count.desc(), MarketBuilding.name)
    )
    if street_id is not None:
        query = query.where(MarketBuilding.street_id == street_id)
    if limit is not None:
        query = query.limit(limit)
    rows = await session.execute(query)
    return [
        BuildingRow(
            place=_place(
                building.slug,
                building.name,
                building_path(city.slug, neighborhood.slug, building.slug),
            ),
            street_name=street.name,
            street_number=building.street_number,
            construction_year=building.construction_year,
            stats=gates.publish(stats, gates.building_all),
        )
        for building, street, stats in rows
    ]


async def _top_buildings(
    session: AsyncSession, city: MarketCity, neighborhood: MarketNeighborhood, gates: Gates
) -> list[BuildingRow]:
    return await _buildings(session, city, neighborhood, gates)


async def street_page(  # noqa: PLR0911 - one return per outcome
    session: AsyncSession, city_slug: str, neighborhood_slug: str, slug: str, gates: Gates
) -> StreetPage | Redirect | None:
    city = await _city(session, city_slug)
    if city is None:
        return None
    neighborhood = await _neighborhood(session, city, neighborhood_slug)
    if neighborhood is None:
        return None
    if isinstance(neighborhood, Redirect):
        return Redirect(path=f"{neighborhood.path}/{slug}")
    street = await session.scalar(
        select(MarketStreet).where(
            MarketStreet.neighborhood_id == neighborhood.id, MarketStreet.slug == slug
        )
    )
    if street is None:
        target = await _redirect_target(session, SlugEntity.STREET, neighborhood.id, slug)
        if isinstance(target, MarketStreet):
            parent = await session.get(MarketNeighborhood, target.neighborhood_id)
            if parent:
                return Redirect(path=street_path(city.slug, parent.slug, target.slug))
        return None
    gate_stats = await _one(session, StatsEntity.STREET, street.id, "all", "last_36m")
    gate = _gate(gates, StatsEntity.STREET, gate_stats, neighborhood.is_indexable)
    minimum = gates.street_36m
    page = StreetPage(
        city=_place(city.slug, city.name, city_path(city.slug)),
        neighborhood=_neighborhood_ref(city.slug, neighborhood),
        street=_place(
            street.slug, street.name, street_path(city.slug, neighborhood.slug, street.slug)
        ),
        gate=gate,
        source=await source_info(session, city),
        stats=None,
        sales_36m=gate_stats.tx_count if gate_stats else 0,
        last_12m=None,
        sales_by_year=[],
        buildings=await _buildings(
            session, city, neighborhood, gates, street_id=street.id, limit=None
        ),
        similar_streets=await _top_streets(session, city, neighborhood, gates, exclude=street.id),
    )
    if not gate.passes:
        return page  # counts, buildings and links; no prices
    page.stats = gates.publish(gate_stats, minimum)
    page.last_12m = gates.publish(
        await _one(session, StatsEntity.STREET, street.id, "all", "last_12m"), 1
    )
    page.sales_by_year = await sales_by_year(
        session, ItbiTransaction.street_id, street.id, page.source.window_end
    )
    return page


async def building_page(  # noqa: PLR0911 - one return per outcome
    session: AsyncSession, city_slug: str, neighborhood_slug: str, slug: str, gates: Gates
) -> BuildingPage | Redirect | None:
    city = await _city(session, city_slug)
    if city is None:
        return None
    neighborhood = await _neighborhood(session, city, neighborhood_slug)
    if neighborhood is None:
        return None
    if isinstance(neighborhood, Redirect):
        new_slug = neighborhood.path.rsplit("/", 1)[-1]
        return Redirect(path=building_path(city.slug, new_slug, slug))
    building = await session.scalar(
        select(MarketBuilding).where(
            MarketBuilding.neighborhood_id == neighborhood.id, MarketBuilding.slug == slug
        )
    )
    if building is None:
        target = await _redirect_target(session, SlugEntity.BUILDING, neighborhood.id, slug)
        if isinstance(target, MarketBuilding):
            parent = await session.get(MarketNeighborhood, target.neighborhood_id)
            if parent:
                return Redirect(path=building_path(city.slug, parent.slug, target.slug))
        return None
    street = await session.get(MarketStreet, building.street_id)
    if street is None:
        return None
    gate_stats = await _one(session, StatsEntity.BUILDING, building.id, "all", "all")
    gate = _gate(gates, StatsEntity.BUILDING, gate_stats, neighborhood.is_indexable)
    page = BuildingPage(
        city=_place(city.slug, city.name, city_path(city.slug)),
        neighborhood=_neighborhood_ref(city.slug, neighborhood),
        street=_place(
            street.slug, street.name, street_path(city.slug, neighborhood.slug, street.slug)
        ),
        building=_place(
            building.slug,
            building.name,
            building_path(city.slug, neighborhood.slug, building.slug),
        ),
        street_number=building.street_number,
        construction_year=building.construction_year,
        gate=gate,
        source=await source_info(session, city),
        stats=None,
        sales=gate_stats.tx_count if gate_stats else 0,
        last_24m=None,
        sales_by_year=[],
        comparison=None,
        street_stats=None,
        other_buildings=[
            b
            for b in await _buildings(
                session, city, neighborhood, gates, street_id=street.id, limit=None
            )
            if b.place.slug != building.slug
        ],
    )
    # The street's numbers are the fallback when the building has few priced sales.
    street_all = await _one(session, StatsEntity.STREET, street.id, "all", "all")
    page.street_stats = gates.publish(street_all, gates.street_36m)
    if not gate.passes:
        page.construction_year = None  # nothing about a building below the gate
        return page
    page.stats = gates.publish(gate_stats, gates.building_all)
    page.last_24m = gates.publish(
        await _one(session, StatsEntity.BUILDING, building.id, "all", "last_24m"), 1
    )
    page.sales_by_year = await sales_by_year(
        session, ItbiTransaction.building_id, building.id, page.source.window_end
    )
    neighborhood_all = await _one(session, StatsEntity.NEIGHBORHOOD, neighborhood.id, "all", "all")
    page.comparison = price_comparison(gates, gate_stats, street_all, neighborhood_all)
    return page


async def financing_page(
    session: AsyncSession, city_slug: str, slug: str, gates: Gates, settings: Settings
) -> FinancingPage | Redirect | None:
    city = await _city(session, city_slug)
    if city is None:
        return None
    neighborhood = await _neighborhood(session, city, slug)
    if neighborhood is None:
        return None
    if isinstance(neighborhood, Redirect):
        new_slug = neighborhood.path.rsplit("/", 1)[-1]
        return Redirect(path=financing_path(city.slug, new_slug))
    nid = neighborhood.id
    gate_stats = await _one(session, StatsEntity.NEIGHBORHOOD, nid, "all", "last_12m")
    gate = _gate(gates, StatsEntity.NEIGHBORHOOD, gate_stats, neighborhood.is_indexable)
    source = await source_info(session, city)
    apartments = gates.publish(
        await _one(session, StatsEntity.NEIGHBORHOOD, nid, "apartment", "last_12m"),
        gates.neighborhood_12m,
    )
    everything = gates.publish(gate_stats, gates.neighborhood_12m) if gate.passes else None
    chosen = apartments if apartments and apartments.median_value_cents else everything
    median_value = chosen.median_value_cents if chosen else None
    page = FinancingPage(
        city=_place(city.slug, city.name, city_path(city.slug)),
        neighborhood=_neighborhood_ref(city.slug, neighborhood),
        gate=gate,
        source=source,
        property_kind="apartment" if chosen is apartments and apartments else "all",
        median_value_cents=median_value if gate.passes else None,
        down_payment_pct=settings.market_down_payment_pct,
        term_months=settings.market_term_months,
        annual_rate_bps=settings.financing_illustrative_annual_rate_bps,
        max_income_commitment_pct=settings.market_max_income_commitment_pct,
        min_down_payment_pct=settings.market_min_down_payment_pct,
        simulations=[],
        financing=await _financing_context(session, nid, source.window_end, gates)
        if gate.passes
        else None,
        financed_by_year=[],
        neighbors=[],
    )
    if gate.passes and median_value:
        page.simulations = simulations(median_value, settings)
        page.financed_by_year = await _financed_by_year(session, nid, source.window_end, gates)
        page.neighbors = await _neighbor_incomes(session, city, nid, gates, settings)
    return page


async def _financed_by_year(
    session: AsyncSession, neighborhood_id: uuid.UUID, end: date | None, gates: Gates
) -> list[FinancedYear]:
    """Share of purchases with declared financing per year (years that pass the gate)."""
    if end is None:
        return []
    keys = [f"y{y}" for y in range(FIRST_YEAR, end.year + 1)]
    rows = await session.scalars(
        select(MarketStats).where(
            MarketStats.entity_type == StatsEntity.NEIGHBORHOOD,
            MarketStats.entity_id == neighborhood_id,
            MarketStats.kind == "all",
            MarketStats.window.in_(keys),
        )
    )
    out = []
    for stats in sorted(rows, key=lambda r: r.window):
        public = gates.publish(stats, gates.neighborhood_12m)
        if public is None or public.financed_pct is None:
            continue
        year = int(stats.window[1:])
        out.append(
            FinancedYear(
                year=year,
                financed_pct=public.financed_pct,
                partial_until=end if year == end.year and end.month < 12 else None,
            )
        )
    return out


async def _neighbor_incomes(
    session: AsyncSession,
    city: MarketCity,
    neighborhood_id: uuid.UUID,
    gates: Gates,
    settings: Settings,
) -> list[NeighborIncome]:
    """Neighbors' median price and the income the same simulation indicates."""
    out = []
    for row in await _neighbors(session, city, neighborhood_id, gates):
        value = row.stats.median_value_cents if row.stats else None
        if not value:
            continue
        sac = next((s for s in simulations(value, settings) if s.system == "sac"), None)
        if sac:
            out.append(
                NeighborIncome(
                    place=row.place, median_value_cents=value, min_income_cents=sac.min_income_cents
                )
            )
    return out


def simulations(price_cents: int, settings: Settings, fgts_cents: int = 0) -> list[Simulation]:
    """SAC and Price for the page defaults (core/finance.py; a simulation, never an approval)."""
    down = price_cents * settings.market_down_payment_pct // 100
    out: list[Simulation] = []
    for system in (AmortizationSystem.SAC, AmortizationSystem.PRICE):
        try:
            result = simulate(
                property_price_cents=price_cents,
                down_payment_cents=down,
                fgts_cents=fgts_cents,
                term_months=settings.market_term_months,
                annual_rate_bps=settings.financing_illustrative_annual_rate_bps,
                system=system,
            )
        except FinancingInputError:
            continue
        min_income = -(
            -result.first_payment_cents * 100 // settings.market_max_income_commitment_pct
        )
        out.append(
            Simulation(
                system=system.value,
                property_price_cents=price_cents,
                down_payment_cents=down,
                fgts_cents=fgts_cents,
                principal_cents=result.principal_cents,
                term_months=result.term_months,
                annual_rate_bps=result.annual_rate_bps,
                first_payment_cents=result.first_payment_cents,
                last_payment_cents=result.last_payment_cents,
                total_interest_cents=result.total_interest_cents,
                min_income_cents=min_income,
            )
        )
    return out


# --- sitemaps ---------------------------------------------------------------------------------


async def sitemap(
    session: AsyncSession,
    city_slug: str,
    template: str,
    gates: Gates,
    *,
    itbi_reviewed: bool = False,
) -> Sitemap | None:
    city = await _city(session, city_slug)
    if city is None or template not in SITEMAP_TEMPLATES:
        return None
    entries: list[SitemapEntry] = []
    if template == "imoveis":
        # Listing pages are indexable only with 3+ live authorized listings; none exist yet.
        return Sitemap(template="imoveis", entries=[])
    if template == "itbi":
        source = await source_info(session, city)
        if itbi_reviewed:  # noindex until a person reviews the legal rules
            entries.append(
                SitemapEntry(path=f"/itbi/{city.slug}", last_modified=source.refreshed_at)
            )
        return Sitemap(template="itbi", entries=entries)
    if template in {"bairros", "financiamento", "avaliacao"}:
        rows = await session.execute(
            select(MarketNeighborhood, MarketStats)
            .join(
                MarketStats,
                and_(
                    MarketStats.entity_id == MarketNeighborhood.id,
                    MarketStats.entity_type == StatsEntity.NEIGHBORHOOD,
                    MarketStats.kind == "all",
                    MarketStats.window == "last_12m",
                ),
            )
            .where(
                MarketNeighborhood.city_id == city.id,
                MarketNeighborhood.is_indexable,
                MarketStats.median_sample >= gates.neighborhood_12m,
            )
            .order_by(MarketNeighborhood.slug)
        )
        path = {
            "bairros": neighborhood_path,
            "financiamento": financing_path,
            "avaliacao": valuation_path,
        }[template]
        if template in {"bairros", "avaliacao"}:
            source = await source_info(session, city)
            top = city_path(city.slug) if template == "bairros" else "/quanto-vale-meu-imovel"
            entries.append(SitemapEntry(path=top, last_modified=source.refreshed_at))
        entries += [
            SitemapEntry(path=path(city.slug, n.slug), last_modified=s.refreshed_at)
            for n, s in rows
        ]
    elif template == "ruas":
        rows_s = await session.execute(
            select(MarketStreet, MarketNeighborhood, MarketStats)
            .join(MarketNeighborhood, MarketNeighborhood.id == MarketStreet.neighborhood_id)
            .join(
                MarketStats,
                and_(
                    MarketStats.entity_id == MarketStreet.id,
                    MarketStats.entity_type == StatsEntity.STREET,
                    MarketStats.kind == "all",
                    MarketStats.window == "last_36m",
                ),
            )
            .where(
                MarketStreet.city_id == city.id,
                MarketNeighborhood.is_indexable,
                MarketStats.median_sample >= gates.street_36m,
            )
            .order_by(MarketNeighborhood.slug, MarketStreet.slug)
        )
        entries = [
            SitemapEntry(path=street_path(city.slug, n.slug, st.slug), last_modified=s.refreshed_at)
            for st, n, s in rows_s
        ]
    else:
        rows_b = await session.execute(
            select(MarketBuilding, MarketNeighborhood, MarketStats)
            .join(MarketNeighborhood, MarketNeighborhood.id == MarketBuilding.neighborhood_id)
            .join(
                MarketStats,
                and_(
                    MarketStats.entity_id == MarketBuilding.id,
                    MarketStats.entity_type == StatsEntity.BUILDING,
                    MarketStats.kind == "all",
                    MarketStats.window == "all",
                ),
            )
            .where(
                MarketBuilding.city_id == city.id,
                MarketNeighborhood.is_indexable,
                MarketStats.median_sample >= gates.building_all,
            )
            .order_by(MarketNeighborhood.slug, MarketBuilding.slug)
        )
        entries = [
            SitemapEntry(
                path=building_path(city.slug, n.slug, b.slug), last_modified=s.refreshed_at
            )
            for b, n, s in rows_b
        ]
    return Sitemap(template=template, entries=entries)


# --- SEO-3 helpers ----------------------------------------------------------------------------


def change_pct(current: int | None, previous: int | None) -> Decimal | None:
    """Percent change, one decimal; None without both numbers."""
    if not current or not previous:
        return None
    return ((Decimal(current) / Decimal(previous) - 1) * 100).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    )


async def published_12m(
    session: AsyncSession,
    entity: StatsEntity,
    ids: Sequence[uuid.UUID],
    gates: Gates,
    min_count: int,
) -> dict[uuid.UUID, PublicStats]:
    """Last-12-month stats with the change vs. the 12 months before.

    The price change is published only when both windows pass the price group; the sales
    change only when both pass ``min_count``.
    """
    current = await _stats(session, entity, ids, "all", "last_12m")
    previous = await _stats(session, entity, ids, "all", "prev_12m")
    out: dict[uuid.UUID, PublicStats] = {}
    for entity_id, stats in current.items():
        public = gates.publish(stats, min_count)
        if public is None:
            continue
        before = previous.get(entity_id)
        if before is not None:
            if public.priced and gates.priced(before.median_sample):
                public.median_price_m2_change_12m_pct = change_pct(
                    stats.median_price_m2_cents, before.median_price_m2_cents
                )
            if before.tx_count >= min_count:
                public.sales_change_12m_pct = change_pct(stats.tx_count, before.tx_count)
        out[entity_id] = public
    return out


async def sales_by_year(
    session: AsyncSession, column: Any, entity_id: uuid.UUID, end: date | None
) -> list[YearCount]:
    """Sales per calendar year since FIRST_YEAR (counts only: never prices or dates)."""
    if end is None:
        return []
    year = func.extract("year", ItbiTransaction.transaction_date)
    rows = await session.execute(
        select(year, func.count())
        .where(
            column == entity_id,
            ItbiTransaction.transaction_date >= date(FIRST_YEAR, 1, 1),
            ItbiTransaction.transaction_date <= end,
        )
        .group_by(year)
    )
    counts = {int(y): n for y, n in rows}
    return [
        YearCount(
            year=y,
            sales=counts.get(y, 0),
            partial_until=end if y == end.year and end.month < 12 else None,
        )
        for y in range(FIRST_YEAR, end.year + 1)
    ]


def price_comparison(
    gates: Gates,
    building: MarketStats | None,
    street: MarketStats | None,
    neighborhood: MarketStats | None,
) -> PriceComparison | None:
    """Building vs. street vs. neighborhood R$/m² (all history); each side only when priced."""

    def priced(stats: MarketStats | None) -> int | None:
        return stats.median_price_m2_cents if stats and gates.priced(stats.median_sample) else None

    b, s, n = priced(building), priced(street), priced(neighborhood)
    if b is None:
        return None
    return PriceComparison(
        building_price_m2_cents=gates.price_m2(b),
        street_price_m2_cents=gates.price_m2(s),
        neighborhood_price_m2_cents=gates.price_m2(n),
        vs_neighborhood_pct=change_pct(b, n),
    )
