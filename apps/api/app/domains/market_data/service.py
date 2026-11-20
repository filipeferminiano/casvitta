"""Read side of the public price pages. Every number goes through gates.Gates.publish."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.finance import AmortizationSystem, FinancingInputError, simulate
from app.core.settings import Settings
from app.domains.market_data.gates import MIN_GROUP, Gates
from app.domains.market_data.models import (
    ItbiIngestionRun,
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
    FinancingContext,
    FinancingPage,
    GateInfo,
    MonthlyPoint,
    NeighborhoodPage,
    NeighborhoodRow,
    PlaceRef,
    Redirect,
    Simulation,
    Sitemap,
    SitemapEntry,
    SourceInfo,
    StreetPage,
    StreetRow,
    YearRow,
)
from app.domains.market_data.stats import round_to

TOP_LIMIT = 10
FIRST_YEAR = 2019


# --- paths ------------------------------------------------------------------------------------


def city_path(city: str) -> str:
    return f"/preco-m2/{city}"


def neighborhood_path(city: str, neighborhood: str) -> str:
    return f"/preco-m2/{city}/{neighborhood}"


def street_path(city: str, neighborhood: str, street: str) -> str:
    return f"/preco-m2/{city}/{neighborhood}/{street}"


def building_path(city: str, neighborhood: str, building: str) -> str:
    return f"/condominio/{city}/{neighborhood}/{building}"


def financing_path(city: str, neighborhood: str) -> str:
    return f"/financiamento/{city}/{neighborhood}"


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
    stats = await _stats(
        session, StatsEntity.NEIGHBORHOOD, [n.id for n in neighborhoods], "all", "last_12m"
    )
    rows = []
    for n in neighborhoods:
        public = gates.publish(stats.get(n.id), gates.neighborhood_12m)
        if public is None and not n.is_indexable:
            continue  # the index lists neighborhoods with numbers, plus curated ones
        rows.append(
            NeighborhoodRow(
                place=_place(n.slug, n.name, neighborhood_path(city.slug, n.slug)),
                zone=n.zone,
                indexable=n.is_indexable and public is not None,
                stats=public,
            )
        )
    return CityIndexPage(
        city=_place(city.slug, city.name, city_path(city.slug)),
        source=await source_info(session, city),
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
    ref = _place(neighborhood.slug, neighborhood.name, neighborhood_path(city.slug, slug))
    page = NeighborhoodPage(
        city=city_ref,
        neighborhood=ref,
        gate=gate,
        source=source,
        stats=None,
        apartments=None,
        houses=None,
        years=[],
        monthly=[],
        area_bands=[],
        top_streets=[],
        top_buildings=[],
        neighbors=await _neighbors(session, city, nid, gates),
        financing=None,
    )
    if not gate.passes:
        return page  # "poucos dados": links only

    minimum = gates.neighborhood_12m
    page.stats = gates.publish(gate_stats, minimum)
    page.apartments = gates.publish(
        await _one(session, StatsEntity.NEIGHBORHOOD, nid, "apartment", "last_12m"), minimum
    )
    page.houses = gates.publish(
        await _one(session, StatsEntity.NEIGHBORHOOD, nid, "house", "last_12m"), minimum
    )
    page.years = await _years(session, nid, source.window_end, gates)
    page.monthly = await _monthly(session, nid)
    apartments_12m = await _one(session, StatsEntity.NEIGHBORHOOD, nid, "apartment", "last_12m")
    page.area_bands = [
        AreaBand(
            band=b["band"],
            min_m2=b["min_m2"],
            max_m2=b["max_m2"],
            sales=b["tx_count"],
            median_value_cents=gates.value(b["median_value_cents"])
            if b["median_sample"] >= MIN_GROUP
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
    stats = await _stats(
        session, StatsEntity.NEIGHBORHOOD, [n.id for n in neighbors], "all", "last_12m"
    )
    rows = []
    for n in neighbors:
        public = gates.publish(stats.get(n.id), gates.neighborhood_12m)
        rows.append(
            NeighborhoodRow(
                place=_place(n.slug, n.name, neighborhood_path(city.slug, n.slug)),
                zone=n.zone,
                indexable=n.is_indexable and public is not None,
                stats=public,
            )
        )
    return rows


async def _years(
    session: AsyncSession, neighborhood_id: uuid.UUID, end: date | None, gates: Gates
) -> list[YearRow]:
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
    by_window = {r.window: r for r in rows}
    return [
        YearRow(
            year=int(key[1:]),
            partial_until=end if int(key[1:]) == end.year and end.month < 12 else None,
            stats=gates.publish(by_window.get(key), gates.neighborhood_12m),
        )
        for key in keys
    ]


async def _monthly(session: AsyncSession, neighborhood_id: uuid.UUID) -> list[MonthlyPoint]:
    rows = await session.scalars(
        select(MarketMonthly)
        .where(MarketMonthly.neighborhood_id == neighborhood_id, MarketMonthly.kind == "all")
        .order_by(MarketMonthly.month)
    )
    return [
        MonthlyPoint(
            month=f"{r.month.year:04d}-{r.month.month:02d}",
            sales=r.tx_count,
            # Price per m² already rounded like every other published price.
            median_price_m2_cents=round_to(r.median_price_m2_cents, 1_000)
            if r.median_price_m2_cents is not None and r.median_sample >= MIN_GROUP
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
    session: AsyncSession, city: MarketCity, neighborhood: MarketNeighborhood, gates: Gates
) -> list[StreetRow]:
    rows = await session.execute(
        select(MarketStreet, MarketStats)
        .join(
            MarketStats,
            and_(
                MarketStats.entity_id == MarketStreet.id,
                MarketStats.entity_type == StatsEntity.STREET,
                MarketStats.kind == "all",
                MarketStats.window == "last_24m",
            ),
        )
        .where(
            MarketStreet.neighborhood_id == neighborhood.id,
            MarketStats.median_sample >= gates.street_24m,
        )
        .order_by(MarketStats.tx_count.desc(), MarketStreet.name)
        .limit(TOP_LIMIT)
    )
    return [
        StreetRow(
            place=_place(
                street.slug, street.name, street_path(city.slug, neighborhood.slug, street.slug)
            ),
            stats=gates.publish(stats, gates.street_24m),
        )
        for street, stats in rows
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
    gate_stats = await _one(session, StatsEntity.STREET, street.id, "all", "last_24m")
    gate = _gate(gates, StatsEntity.STREET, gate_stats, neighborhood.is_indexable)
    minimum = gates.street_24m
    page = StreetPage(
        city=_place(city.slug, city.name, city_path(city.slug)),
        neighborhood=_place(
            neighborhood.slug, neighborhood.name, neighborhood_path(city.slug, neighborhood.slug)
        ),
        street=_place(
            street.slug, street.name, street_path(city.slug, neighborhood.slug, street.slug)
        ),
        gate=gate,
        source=await source_info(session, city),
        stats=None,
        last_12m=None,
        apartments=None,
        buildings=[],
    )
    if not gate.passes:
        return page
    page.stats = gates.publish(gate_stats, minimum)
    page.last_12m = gates.publish(
        await _one(session, StatsEntity.STREET, street.id, "all", "last_12m"), minimum
    )
    page.apartments = gates.publish(
        await _one(session, StatsEntity.STREET, street.id, "apartment", "last_24m"), minimum
    )
    page.buildings = await _buildings(
        session, city, neighborhood, gates, street_id=street.id, limit=None
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
        neighborhood=_place(
            neighborhood.slug, neighborhood.name, neighborhood_path(city.slug, neighborhood.slug)
        ),
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
        last_24m=None,
    )
    if not gate.passes:
        page.construction_year = None  # nothing about a building below the gate
        return page
    page.stats = gates.publish(gate_stats, gates.building_all)
    page.last_24m = gates.publish(
        await _one(session, StatsEntity.BUILDING, building.id, "all", "last_24m"),
        gates.building_all,
    )
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
        neighborhood=_place(
            neighborhood.slug, neighborhood.name, neighborhood_path(city.slug, neighborhood.slug)
        ),
        gate=gate,
        source=source,
        property_kind="apartment" if chosen is apartments and apartments else "all",
        median_value_cents=median_value if gate.passes else None,
        down_payment_pct=settings.market_down_payment_pct,
        term_months=settings.market_term_months,
        annual_rate_bps=settings.financing_illustrative_annual_rate_bps,
        max_income_commitment_pct=settings.market_max_income_commitment_pct,
        simulations=[],
        financing=await _financing_context(session, nid, source.window_end, gates)
        if gate.passes
        else None,
    )
    if gate.passes and median_value:
        page.simulations = simulations(median_value, settings)
    return page


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
                min_income_cents=min_income,
            )
        )
    return out


# --- sitemaps ---------------------------------------------------------------------------------


async def sitemap(
    session: AsyncSession, city_slug: str, template: str, gates: Gates
) -> Sitemap | None:
    city = await _city(session, city_slug)
    if city is None or template not in {"bairros", "ruas", "condominios", "financiamento"}:
        return None
    entries: list[SitemapEntry] = []
    if template in {"bairros", "financiamento"}:
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
        path = neighborhood_path if template == "bairros" else financing_path
        if template == "bairros":
            source = await source_info(session, city)
            entries.append(
                SitemapEntry(path=city_path(city.slug), last_modified=source.refreshed_at)
            )
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
                    MarketStats.window == "last_24m",
                ),
            )
            .where(
                MarketStreet.city_id == city.id,
                MarketNeighborhood.is_indexable,
                MarketStats.median_sample >= gates.street_24m,
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
