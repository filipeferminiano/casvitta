"""Valuation estimate ("Quanto vale meu imóvel") from real ITBI sales: a statistic, no appraisal.

Method (thresholds in settings, see ``ValuationRules``):
1. Comparable sales: cleaned purchases of the same kind (apartment / house) in the last 24 months
   up to the window end, without quality flags.
2. Groups, from most to least specific (weight in brackets):
   - same street × area band [4]
   - same neighborhood × area band [2]
   - same neighborhood × construction-year band, only when the year is given [1.5]
   - neighbor neighborhoods × area band [1]
   A group is *usable* only with ``min_group`` (10) sales; smaller groups are reported with their
   count and no price.
3. Estimate R$/m² = weighted median of the usable groups' median R$/m², weight = level × √sales.
   Value = estimate × the IPTU built area the person entered (the same area the R$/m² uses).
4. Range = weighted median of the groups' p25 and p75 R$/m² × area, widened by up to 50 % when
   the largest usable group has fewer than ``full_confidence_sales`` sales.
5. Confidence: "alta" with ≥ 30 comparables, a street or neighborhood band group and a spread
   (range ÷ estimate) ≤ 25 %; "media" with ≥ 15 comparables or spread ≤ 40 %; else "baixa".
   No usable group → outside coverage.
Bedrooms and parking are not in ITBI data; they never enter the math (they go to the lead).
"""

from __future__ import annotations

import math
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from app.domains.market_data.aggregate import add_months, area_band
from app.domains.market_data.models import (
    ItbiTransaction,
    MarketNeighborhoodAdjacency,
    PropertyKind,
)
from app.domains.market_data.stats import percentile, round_to

GroupLevel = Literal["street_band", "neighborhood_band", "neighborhood_year", "neighbors_band"]
Confidence = Literal["alta", "media", "baixa"]
LEVEL_WEIGHTS: dict[GroupLevel, float] = {
    "street_band": 4.0,
    "neighborhood_band": 2.0,
    "neighborhood_year": 1.5,
    "neighbors_band": 1.0,
}
YEAR_BANDS: tuple[tuple[str, int, int | None], ...] = (
    ("ate-1979", 0, 1980),
    ("1980-1999", 1980, 2000),
    ("2000-2009", 2000, 2010),
    ("2010-mais", 2010, None),
)


@dataclass(frozen=True, slots=True)
class ValuationRules:
    min_group: int = 10
    months: int = 24
    full_confidence_sales: int = 30
    high_spread: float = 0.25
    medium_sales: int = 15
    medium_spread: float = 0.40
    max_widening: float = 0.5
    round_value_cents: int = 100_000  # R$ 1.000

    @classmethod
    def from_settings(cls, settings: Settings) -> ValuationRules:
        return cls(
            min_group=settings.market_min_price_group,
            months=settings.valuation_months,
            full_confidence_sales=settings.valuation_full_confidence_sales,
            high_spread=settings.valuation_high_spread_pct / 100,
            medium_sales=settings.valuation_medium_sales,
            medium_spread=settings.valuation_medium_spread_pct / 100,
            round_value_cents=settings.market_round_value_cents,
        )


@dataclass(frozen=True, slots=True)
class Group:
    level: GroupLevel
    label: str  # area band key or year band key
    sales: int
    median_price_m2_cents: int | None  # None below the minimum group
    p25_price_m2_cents: int | None
    p75_price_m2_cents: int | None

    @property
    def usable(self) -> bool:
        return self.median_price_m2_cents is not None


@dataclass(frozen=True, slots=True)
class Estimate:
    center_cents: int
    low_cents: int
    high_cents: int
    price_m2_cents: int
    confidence: Confidence
    comparables: int
    basis: GroupLevel
    groups: list[Group]


def year_band(year: int) -> str:
    for key, low, high in YEAR_BANDS:
        if year >= low and (high is None or year < high):
            return key
    return YEAR_BANDS[-1][0]


def summarize_group(
    level: GroupLevel, label: str, prices: Sequence[int], rules: ValuationRules
) -> Group:
    if len(prices) < rules.min_group:
        return Group(level, label, len(prices), None, None, None)
    ordered = sorted(prices)
    return Group(
        level,
        label,
        len(prices),
        percentile(ordered, 50),
        percentile(ordered, 25),
        percentile(ordered, 75),
    )


def weighted_median(pairs: Sequence[tuple[int, float]]) -> int:
    """Value at which the cumulative weight reaches half of the total."""
    ordered = sorted(pairs)
    total = sum(w for _, w in ordered)
    cumulative = 0.0
    for value, weight in ordered:
        cumulative += weight
        if cumulative >= total / 2:
            return value
    return ordered[-1][0]


def estimate(groups: Sequence[Group], area_m2: Decimal, rules: ValuationRules) -> Estimate | None:
    usable = [g for g in groups if g.usable]
    if not usable:
        return None

    def weight(g: Group) -> float:
        return LEVEL_WEIGHTS[g.level] * math.sqrt(g.sales)

    price = weighted_median([(g.median_price_m2_cents or 0, weight(g)) for g in usable])
    low = weighted_median([(g.p25_price_m2_cents or 0, weight(g)) for g in usable])
    high = weighted_median([(g.p75_price_m2_cents or 0, weight(g)) for g in usable])
    comparables = max(g.sales for g in usable)
    widen = 1 + rules.max_widening * max(
        0.0, (rules.full_confidence_sales - comparables) / rules.full_confidence_sales
    )
    low = round(price - (price - min(low, price)) * widen)
    high = round(price + (max(high, price) - price) * widen)
    spread = (high - low) / price if price else math.inf
    most_specific = min(usable, key=lambda g: list(LEVEL_WEIGHTS).index(g.level)).level
    if (
        comparables >= rules.full_confidence_sales
        and spread <= rules.high_spread
        and most_specific in ("street_band", "neighborhood_band")
    ):
        confidence: Confidence = "alta"
    elif comparables >= rules.medium_sales or spread <= rules.medium_spread:
        confidence = "media"
    else:
        confidence = "baixa"
    area = Decimal(area_m2)
    return Estimate(
        center_cents=round_to(int(price * area), rules.round_value_cents),
        low_cents=round_to(int(low * area), rules.round_value_cents),
        high_cents=round_to(int(high * area), rules.round_value_cents),
        price_m2_cents=round_to(price, 1_000),
        confidence=confidence,
        comparables=comparables,
        basis=most_specific,
        groups=list(groups),
    )


async def comparable_groups(
    session: AsyncSession,
    *,
    neighborhood_id: uuid.UUID,
    street_id: uuid.UUID | None,
    kind: PropertyKind,
    area_m2: Decimal,
    year: int | None,
    window_end: date,
    rules: ValuationRules,
) -> list[Group]:
    """Groups in order of specificity (only those with at least one sale)."""
    start = add_months(window_end.replace(day=1), -(rules.months - 1))
    neighbors = list(
        await session.scalars(
            select(MarketNeighborhoodAdjacency.neighbor_id).where(
                MarketNeighborhoodAdjacency.neighborhood_id == neighborhood_id
            )
        )
    )
    rows = await session.execute(
        select(
            ItbiTransaction.neighborhood_id,
            ItbiTransaction.street_id,
            ItbiTransaction.built_area_m2,
            ItbiTransaction.construction_year,
            ItbiTransaction.price_m2_cents,
        ).where(
            ItbiTransaction.neighborhood_id.in_([neighborhood_id, *neighbors]),
            ItbiTransaction.kind == kind,
            ItbiTransaction.transaction_date >= start,
            ItbiTransaction.transaction_date <= window_end,
            ItbiTransaction.under_declared.is_(False),
            ItbiTransaction.price_outlier.is_(False),
        )
    )
    band = area_band(area_m2)
    wanted_year = year_band(year) if year else None
    street_band: list[int] = []
    neighborhood_band: list[int] = []
    neighborhood_year: list[int] = []
    neighbors_band: list[int] = []
    for nid, sid, area, built, price in rows:
        same_band = area_band(area) == band
        if nid == neighborhood_id:
            if same_band:
                neighborhood_band.append(price)
                if street_id is not None and sid == street_id:
                    street_band.append(price)
            if wanted_year and built and year_band(built) == wanted_year:
                neighborhood_year.append(price)
        elif same_band:
            neighbors_band.append(price)
    candidates: list[tuple[GroupLevel, str, list[int]]] = [
        ("street_band", band, street_band),
        ("neighborhood_band", band, neighborhood_band),
    ]
    if wanted_year:
        candidates.append(("neighborhood_year", wanted_year, neighborhood_year))
    candidates.append(("neighbors_band", band, neighbors_band))
    return [
        summarize_group(level, label, prices, rules)
        for level, label, prices in candidates
        if prices
    ]
