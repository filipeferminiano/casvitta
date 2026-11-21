"""Aggregates per neighborhood, street and building (exact numbers; gating and rounding happen
when they are published, see gates.py).

Windows end at the last complete payment month minus ``market_window_lag_months``: ITBI is paid
weeks after the deed, so the newest months are incomplete.
"""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.market_data.clean import CleanRow
from app.domains.market_data.models import MarketMonthly, MarketStats, PropertyKind, StatsEntity
from app.domains.market_data.places import LocatedRow
from app.domains.market_data.stats import median, percentile

ALL = "all"
FIRST_YEAR = 2019
MONTHS_IN_CHART = 60
MIN_MONTHLY_SAMPLE = 10  # a month's median is stored only from this many sales (price group)
# Built area of the IPTU (common areas included). Shared with the valuation tool.
AREA_BANDS: tuple[tuple[str, int, int | None], ...] = (
    ("ate-50", 0, 50),
    ("50-80", 50, 80),
    ("80-120", 80, 120),
    ("120-mais", 120, None),
)


def area_band(area_m2: Decimal) -> str:
    for key, low, high in AREA_BANDS:
        if area_m2 >= low and (high is None or area_m2 < high):
            return key
    return AREA_BANDS[-1][0]


INSERT_BATCH = 1_000
DAY = timedelta(days=1)


@dataclass(frozen=True, slots=True)
class Window:
    key: str
    start: date | None  # None: no lower bound ("all")
    end: date

    def contains(self, day: date) -> bool:
        return (self.start is None or day >= self.start) and day <= self.end


def month_start(day: date) -> date:
    return day.replace(day=1)


def add_months(day: date, months: int) -> date:
    index = day.year * 12 + (day.month - 1) + months
    return date(index // 12, index % 12 + 1, 1)


def window_end(data_through: date, lag_months: int) -> date:
    """Last day of the month ``lag_months`` before the newest payment month."""
    return add_months(month_start(data_through), -lag_months + 1) - timedelta(days=1)


def windows(end: date) -> list[Window]:
    first_of_next = end + DAY
    result = [
        Window("last_12m", add_months(first_of_next, -12), end),
        # The 12 months before last_12m, and the same 12 months five years earlier (changes).
        Window("prev_12m", add_months(first_of_next, -24), add_months(first_of_next, -12) - DAY),
        Window("y5_12m", add_months(first_of_next, -72), add_months(first_of_next, -60) - DAY),
        Window("last_24m", add_months(first_of_next, -24), end),
        Window("last_36m", add_months(first_of_next, -36), end),
        Window(ALL, None, end),
    ]
    for year in range(FIRST_YEAR, end.year + 1):
        result.append(Window(f"y{year}", date(year, 1, 1), min(date(year, 12, 31), end)))
    return result


ENTITY_WINDOWS: dict[StatsEntity, frozenset[str] | None] = {
    StatsEntity.CITY: frozenset({"last_12m", "prev_12m", "y5_12m"}),
    StatsEntity.NEIGHBORHOOD: None,  # every window
    StatsEntity.STREET: frozenset({"last_12m", "last_36m", ALL}),
    StatsEntity.BUILDING: frozenset({"last_24m", ALL}),
}
ENTITY_KINDS: dict[StatsEntity, tuple[str, ...]] = {
    StatsEntity.CITY: (ALL,),
    StatsEntity.NEIGHBORHOOD: (ALL, *(k.value for k in PropertyKind)),
    StatsEntity.STREET: (ALL, PropertyKind.APARTMENT.value, PropertyKind.HOUSE.value),
    StatsEntity.BUILDING: (ALL,),
}


def _ratio(numerator: int, denominator: int) -> Decimal:
    return (Decimal(numerator) / Decimal(denominator)).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP
    )


def _median_decimal(values: Sequence[Decimal]) -> Decimal:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def _percentile_decimal(values: Sequence[Decimal], pct: int) -> Decimal:
    scaled = sorted(int(v * 100) for v in values)
    return Decimal(percentile(scaled, pct)) / 100


def summarize(rows: Sequence[CleanRow]) -> dict[str, Any]:
    """Exact stats of a group. Medians use rows without quality flags only."""
    sample = [r for r in rows if not r.under_declared and not r.price_outlier]
    financed = [r for r in rows if r.has_financing]
    # A declared financed amount above the price is a data error: it still counts as a financed
    # purchase, but not in the median financed share.
    financed_shares = [
        Decimal(r.financed_value_cents) / Decimal(r.value_cents)
        for r in financed
        if r.financed_value_cents and r.financed_value_cents <= r.value_cents
    ]
    types = Counter(r.financing_type_code for r in financed if r.financing_type_code is not None)
    years = sorted(r.construction_year for r in rows if r.construction_year)
    stats: dict[str, Any] = {
        "tx_count": len(rows),
        "median_sample": len(sample),
        "median_value_cents": None,
        "median_price_m2_cents": None,
        "p25_price_m2_cents": None,
        "p75_price_m2_cents": None,
        "median_built_area_m2": None,
        "p25_built_area_m2": None,
        "p75_built_area_m2": None,
        "financed_share": _ratio(len(financed), len(rows)) if rows else None,
        "median_financed_share": (
            _median_decimal(financed_shares).quantize(Decimal("0.0001"))
            if financed_shares
            else None
        ),
        "top_financing_type_code": (
            sorted(types.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] if types else None
        ),
        "median_construction_year": percentile(years, 50) if years else None,
        "last_transaction_month": (
            month_start(max(r.transaction_date for r in rows)) if rows else None
        ),
    }
    if sample:
        prices = sorted(r.price_m2_cents for r in sample)
        areas = [r.built_area_m2 for r in sample]
        stats |= {
            "median_value_cents": median([r.value_cents for r in sample]),
            "median_price_m2_cents": percentile(prices, 50),
            "p25_price_m2_cents": percentile(prices, 25),
            "p75_price_m2_cents": percentile(prices, 75),
            "median_built_area_m2": _median_decimal(areas).quantize(Decimal("0.01")),
            "p25_built_area_m2": _percentile_decimal(areas, 25),
            "p75_built_area_m2": _percentile_decimal(areas, 75),
        }
    return stats


def area_bands(rows: Iterable[CleanRow]) -> list[dict[str, Any]]:
    """Sales by built area (IPTU, common areas included) with the band's median value."""
    groups: dict[str, list[CleanRow]] = {key: [] for key, _, _ in AREA_BANDS}
    for r in rows:
        for key, low, high in AREA_BANDS:
            if r.built_area_m2 >= low and (high is None or r.built_area_m2 < high):
                groups[key].append(r)
                break
    bands = []
    for key, low, high in AREA_BANDS:
        members = groups[key]
        clean = [m for m in members if not m.under_declared and not m.price_outlier]
        bands.append(
            {
                "band": key,
                "min_m2": low,
                "max_m2": high,
                "tx_count": len(members),
                "median_sample": len(clean),
                "median_value_cents": median([m.value_cents for m in clean]) if clean else None,
                "median_price_m2_cents": median([m.price_m2_cents for m in clean])
                if clean
                else None,
            }
        )
    return bands


def compute_stats(
    city_id: uuid.UUID, rows: Sequence[LocatedRow], end: date, refreshed_at: datetime
) -> list[dict[str, Any]]:
    """One dict per entity × kind × window with at least one sale."""
    all_windows = windows(end)
    entity_rows: dict[tuple[StatsEntity, uuid.UUID], list[CleanRow]] = defaultdict(list)
    entity_rows[(StatsEntity.CITY, city_id)] = [located.row for located in rows]
    for located in rows:
        for entity, entity_id in (
            (StatsEntity.NEIGHBORHOOD, located.neighborhood_id),
            (StatsEntity.STREET, located.street_id),
            (StatsEntity.BUILDING, located.building_id),
        ):
            if entity_id is not None:
                entity_rows[(entity, entity_id)].append(located.row)

    out: list[dict[str, Any]] = []
    for (entity, entity_id), members in entity_rows.items():
        allowed = ENTITY_WINDOWS[entity]
        for window in all_windows:
            if allowed is not None and window.key not in allowed:
                continue
            in_window = [r for r in members if window.contains(r.transaction_date)]
            if not in_window:
                continue
            for kind in ENTITY_KINDS[entity]:
                group = in_window if kind == ALL else [r for r in in_window if r.kind == kind]
                if not group:
                    continue
                stats = summarize(group)
                bands = (
                    area_bands(group)
                    if entity is StatsEntity.NEIGHBORHOOD
                    and window.key == "last_12m"
                    and kind == PropertyKind.APARTMENT
                    else []
                )
                out.append(
                    {
                        "id": uuid.uuid4(),
                        "city_id": city_id,
                        "entity_type": entity,
                        "entity_id": entity_id,
                        "kind": kind,
                        "window": window.key,
                        "window_start": window.start,
                        "window_end": window.end,
                        "area_bands": bands,
                        "refreshed_at": refreshed_at,
                    }
                    | stats
                )
    return out


def compute_monthly(
    rows: Sequence[LocatedRow], end: date, rolling_min: int = 10
) -> list[dict[str, Any]]:
    """Last 60 months per neighborhood, for "all" and apartments.

    Each month also carries the median R$/m² of the 12 months ending there (the chart's line);
    it is stored only with ``rolling_min`` sales behind it.
    """
    first = add_months(month_start(end), -(MONTHS_IN_CHART - 1))
    lookback = add_months(first, -11)
    groups: dict[tuple[uuid.UUID, str, date], list[CleanRow]] = defaultdict(list)
    for located in rows:
        r = located.row
        if located.neighborhood_id is None or not (lookback <= r.transaction_date <= end):
            continue
        month = month_start(r.transaction_date)
        groups[(located.neighborhood_id, ALL, month)].append(r)
        if r.kind == PropertyKind.APARTMENT:
            groups[(located.neighborhood_id, PropertyKind.APARTMENT.value, month)].append(r)
    clean: dict[tuple[uuid.UUID, str, date], list[int]] = {
        key: [m.price_m2_cents for m in members if not m.under_declared and not m.price_outlier]
        for key, members in groups.items()
    }
    out = []
    for (neighborhood_id, kind, month), members in groups.items():
        if month < first:
            continue  # lookback months only feed the rolling median
        sample = clean[(neighborhood_id, kind, month)]
        trailing = [
            v
            for k in range(12)
            for v in clean.get((neighborhood_id, kind, add_months(month, -k)), [])
        ]
        out.append(
            {
                "neighborhood_id": neighborhood_id,
                "kind": kind,
                "month": month,
                "tx_count": len(members),
                "median_sample": len(sample),
                "median_price_m2_cents": median(sample)
                if len(sample) >= MIN_MONTHLY_SAMPLE
                else None,
                "rolling_sample": len(trailing),
                "rolling_median_price_m2_cents": median(trailing)
                if len(trailing) >= rolling_min
                else None,
            }
        )
    return out


async def replace_aggregates(
    session: AsyncSession,
    city_id: uuid.UUID,
    neighborhood_ids: Sequence[uuid.UUID],
    stats: Sequence[dict[str, Any]],
    monthly: Sequence[dict[str, Any]],
) -> None:
    await session.execute(delete(MarketStats).where(MarketStats.city_id == city_id))
    if neighborhood_ids:
        await session.execute(
            delete(MarketMonthly).where(MarketMonthly.neighborhood_id.in_(neighborhood_ids))
        )
    for model, rows in ((MarketStats, stats), (MarketMonthly, monthly)):
        for start in range(0, len(rows), INSERT_BATCH):
            await session.execute(insert(model).values(list(rows[start : start + INSERT_BATCH])))
