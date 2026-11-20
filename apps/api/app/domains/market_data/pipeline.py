"""ITBI refresh: read every monthly tab once and rebuild the derived market data.

Stages: ingest (raw copy, optional) -> clean (filters, dedup, flags) -> locate (CEP vote) ->
normalize (neighborhoods, streets, buildings) -> aggregate. Derived tables are rebuilt from the
source on every run, so a rule change only needs a re-run; published slugs stay stable.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.core.time import utcnow
from app.domains.market_data.aggregate import (
    compute_monthly,
    compute_stats,
    replace_aggregates,
    window_end,
)
from app.domains.market_data.clean import (
    CleanRow,
    Exclusion,
    classify,
    dedup_key,
    to_clean,
)
from app.domains.market_data.ingest import (
    RAW_BATCH,
    IngestReport,
    SourceRow,
    get_or_create_city,
    iter_rows,
    store_code_tables,
    store_raw,
)
from app.domains.market_data.locate import LocationIndex, NeighborhoodResolver
from app.domains.market_data.models import ItbiIngestionRun, MarketCity, RunStatus
from app.domains.market_data.places import (
    LocatedRow,
    attach_ids,
    replace_transactions,
    store_review,
    sync_buildings,
    sync_neighborhoods,
    sync_streets,
)
from app.domains.market_data.seeds import SEEDS, NeighborhoodSeed
from app.domains.market_data.stats import outside_p1_p99
from app.integrations.itbi.port import ItbiSource

log = get_logger(__name__)


@dataclass(slots=True)
class RunResult:
    run: ItbiIngestionRun
    city: MarketCity
    ingest: IngestReport
    rows: list[LocatedRow] = field(default_factory=list)
    report: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CleaningState:
    kept: list[CleanRow] = field(default_factory=list)
    seen: set[tuple[str, date, int]] = field(default_factory=set)
    excluded: Counter[str] = field(default_factory=Counter)
    excluded_by_tab: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))

    def take(self, source: SourceRow) -> None:
        verdict = classify(source.row)
        tab = f"{source.file} | {source.tab}"
        if isinstance(verdict, Exclusion):
            self.excluded[verdict] += 1
            self.excluded_by_tab[tab][verdict] += 1
            return
        clean = to_clean(source.row, verdict, source.payment_month)
        key = dedup_key(clean)
        if key in self.seen:  # tabs are read oldest first, so the first payment wins
            self.excluded[Exclusion.DUPLICATE] += 1
            self.excluded_by_tab[tab][Exclusion.DUPLICATE] += 1
            return
        self.seen.add(key)
        self.kept.append(clean)


def flag_price_outliers(rows: list[LocatedRow]) -> int:
    """p1-p99 of price per built m² per neighborhood × kind × year (located rows only)."""
    groups: dict[tuple[str, str, int], list[CleanRow]] = defaultdict(list)
    for located in rows:
        if located.neighborhood_slug:
            r = located.row
            groups[(located.neighborhood_slug, r.kind, r.transaction_date.year)].append(r)
    flagged = 0
    for members in groups.values():
        for row, outside in zip(
            members, outside_p1_p99([m.price_m2_cents for m in members]), strict=True
        ):
            row.price_outlier = outside
            flagged += outside
    return flagged


async def run_ingestion(
    session: AsyncSession, city_slug: str, source: ItbiSource, *, persist_raw: bool
) -> RunResult:
    city = await get_or_create_city(session, city_slug)
    run = ItbiIngestionRun(city_id=city.id, persist_raw=persist_raw, report={})
    session.add(run)
    await session.commit()  # the run is recorded even if the refresh fails
    uses, standards = source.code_tables()
    await store_code_tables(session, uses, standards)

    seeds = SEEDS.get(city_slug, ())
    location = LocationIndex(NeighborhoodResolver.from_seeds(seeds))
    cleaning = CleaningState()
    report = IngestReport()
    try:
        await _read_source(session, city, run, source, report, location, cleaning, persist_raw)
        derived = await _build_derived(session, city, run, seeds, location, cleaning, report)
    except Exception:
        await session.rollback()
        run.status = RunStatus.FAILED
        run.finished_at = utcnow()
        run.report = report.as_dict()
        await session.commit()
        raise

    rows = derived.rows
    summary = _summary(
        report, cleaning, rows, derived.outliers, derived.review, seeds_wave1(city_slug)
    )
    summary |= {"window_end": derived.end.isoformat(), "stats_rows": derived.stats_rows}
    run.status = RunStatus.SUCCEEDED
    run.finished_at = utcnow()
    run.data_through = report.data_through
    run.report = report.as_dict() | summary
    await session.commit()
    log.info("itbi_refreshed", city=city_slug, rows=report.rows_read, kept=len(rows))
    return RunResult(run=run, city=city, ingest=report, rows=rows, report=summary)


async def _read_source(  # noqa: PLR0917
    session: AsyncSession,
    city: MarketCity,
    run: ItbiIngestionRun,
    source: ItbiSource,
    report: IngestReport,
    location: LocationIndex,
    cleaning: CleaningState,
    persist_raw: bool,
) -> None:
    """One pass over the source: CEP votes, cleaning, and the optional raw copy."""
    batch: list[SourceRow] = []
    for source_row in iter_rows(source, report):
        location.observe(source_row.row.cep, source_row.row.neighborhood_raw)
        cleaning.take(source_row)
        if persist_raw:
            batch.append(source_row)
            if len(batch) >= RAW_BATCH:
                await store_raw(session, city.id, run.id, batch, report)
                batch.clear()
    if batch:
        await store_raw(session, city.id, run.id, batch, report)


@dataclass(slots=True)
class Derived:
    rows: list[LocatedRow]
    outliers: int
    review: list[tuple[str, str, int]]
    end: date
    stats_rows: int


async def _build_derived(  # noqa: PLR0917
    session: AsyncSession,
    city: MarketCity,
    run: ItbiIngestionRun,
    seeds: tuple[NeighborhoodSeed, ...],
    location: LocationIndex,
    cleaning: CleaningState,
    report: IngestReport,
) -> Derived:
    location.build()
    rows = [LocatedRow(r, location.locate(r.cep, r.neighborhood_raw)) for r in cleaning.kept]
    outliers = flag_price_outliers(rows)
    used = {r.neighborhood_slug for r in rows if r.neighborhood_slug}
    neighborhoods = await sync_neighborhoods(session, city.id, seeds, location.resolver, used)
    streets = await sync_streets(session, city.id, neighborhoods, rows)
    buildings = await sync_buildings(session, city.id, neighborhoods, streets, rows)
    attach_ids(rows, neighborhoods, streets, buildings)
    await replace_transactions(session, city.id, rows)
    review = await store_review(session, run.id, rows)
    if report.data_through is None:
        raise ValueError("no monthly tabs in the source")
    end = window_end(report.data_through, get_settings().market_window_lag_months)
    stats = compute_stats(city.id, rows, end, utcnow())
    monthly = compute_monthly(rows, end)
    ids = [n.id for n in neighborhoods.values()]
    await replace_aggregates(session, city.id, ids, stats, monthly)
    return Derived(rows, outliers, review, end, len(stats))


def seeds_wave1(city_slug: str) -> set[str]:
    return {s.slug for s in SEEDS.get(city_slug, ()) if s.wave == 1}


def _summary(  # noqa: PLR0917
    report: IngestReport,
    cleaning: CleaningState,
    rows: list[LocatedRow],
    outliers: int,
    review: list[tuple[str, str, int]],
    wave1: set[str],
) -> dict[str, Any]:
    located = [r for r in rows if r.neighborhood_slug]
    # Wave-1 coverage proxy: unresolved rows on streets that resolved mostly to wave 1.
    street_votes: dict[str, Counter[str]] = defaultdict(Counter)
    for r in located:
        street_votes[r.row.street_key][r.neighborhood_slug or ""] += 1
    likely_wave1_unresolved = sum(
        1
        for r in rows
        if not r.neighborhood_slug
        and street_votes.get(r.row.street_key)
        and street_votes[r.row.street_key].most_common(1)[0][0] in wave1
    )
    wave1_rows = sum(1 for r in located if r.neighborhood_slug in wave1)
    per_neighborhood = Counter(r.neighborhood_slug for r in located if r.neighborhood_slug in wave1)
    return {
        "kept": len(rows),
        "excluded": dict(cleaning.excluded.most_common()),
        "excluded_by_tab": {k: dict(v) for k, v in cleaning.excluded_by_tab.items()},
        "flags": {
            "price_outlier": outliers,
            "under_declared": sum(r.row.under_declared for r in rows),
            "bundled_parking": sum(r.row.bundled_parking for r in rows),
        },
        "located": len(located),
        "located_share": round(len(located) / len(rows), 4) if rows else None,
        "unlocated": len(rows) - len(located),
        "wave1": {
            "rows": wave1_rows,
            "likely_unresolved": likely_wave1_unresolved,
            "coverage": round(wave1_rows / (wave1_rows + likely_wave1_unresolved), 4)
            if wave1_rows
            else None,
            "by_neighborhood": dict(per_neighborhood.most_common()),
        },
        "review_top": [{"cep": c, "street": s, "rows": n} for c, s, n in review[:20]],
    }
