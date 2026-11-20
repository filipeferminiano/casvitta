"""Privacy and quality gates: the only way a number leaves the market-data domain.

- An entity page shows numbers only when its gate passes (neighborhood: 30 sales in 12 months;
  street: 10 in 24 months; building: 5 in all history; all configurable).
- Any published median needs at least ``min_count`` sales without quality flags behind it.
- Ranges (p25/p75 price and area) and the month of the last sale need ``market_min_for_ranges``
  sales; below that only the median and the year are shown.
- Values round to R$ 1.000, prices per m² to R$ 10, shares to whole percent.
- Never published: individual sales, SQL, unit, registry data, exact dates, reference values.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.core.settings import Settings
from app.domains.market_data.models import MarketStats, StatsEntity
from app.domains.market_data.schemas import PublicStats
from app.domains.market_data.stats import round_to

AREA_STEP_SMALL_GROUP = 5  # m²: below the ranges threshold the median area rounds to 5 m²
MIN_GROUP = 5  # smallest group whose median may ever be published (monthly points, bands)


@dataclass(frozen=True, slots=True)
class Gates:
    neighborhood_12m: int
    street_24m: int
    building_all: int
    ranges: int
    round_value_cents: int
    round_price_m2_cents: int

    @classmethod
    def from_settings(cls, settings: Settings) -> Gates:
        return cls(
            neighborhood_12m=settings.market_min_neighborhood_12m,
            street_24m=settings.market_min_street_24m,
            building_all=settings.market_min_building_all,
            ranges=settings.market_min_for_ranges,
            round_value_cents=settings.market_round_value_cents,
            round_price_m2_cents=settings.market_round_price_m2_cents,
        )

    def page_threshold(self, entity: StatsEntity) -> tuple[str, int]:
        """(window that decides the gate, minimum sales) for an entity page."""
        return {
            StatsEntity.NEIGHBORHOOD: ("last_12m", self.neighborhood_12m),
            StatsEntity.STREET: ("last_24m", self.street_24m),
            StatsEntity.BUILDING: ("all", self.building_all),
        }[entity]

    def page_passes(self, entity: StatsEntity, gate_stats: MarketStats | None) -> bool:
        _, minimum = self.page_threshold(entity)
        return gate_stats is not None and gate_stats.median_sample >= minimum

    def value(self, cents: int | None) -> int | None:
        return None if cents is None else round_to(cents, self.round_value_cents)

    def price_m2(self, cents: int | None) -> int | None:
        return None if cents is None else round_to(cents, self.round_price_m2_cents)

    def publish(self, stats: MarketStats | None, min_count: int) -> PublicStats | None:
        """Rounded, gated numbers for one entity × kind × window; None below ``min_count``."""
        if stats is None or stats.median_sample < max(min_count, MIN_GROUP):
            return None
        wide = stats.median_sample >= self.ranges
        last = stats.last_transaction_month
        return PublicStats(
            sales=stats.tx_count,
            window=stats.window,
            window_start=stats.window_start,
            window_end=stats.window_end,
            median_value_cents=self.value(stats.median_value_cents),
            median_price_m2_cents=self.price_m2(stats.median_price_m2_cents),
            p25_price_m2_cents=self.price_m2(stats.p25_price_m2_cents) if wide else None,
            p75_price_m2_cents=self.price_m2(stats.p75_price_m2_cents) if wide else None,
            median_built_area_m2=_area(stats.median_built_area_m2, wide),
            p25_built_area_m2=_area(stats.p25_built_area_m2, True) if wide else None,
            p75_built_area_m2=_area(stats.p75_built_area_m2, True) if wide else None,
            financed_pct=_pct(stats.financed_share),
            median_financed_pct=_pct(stats.median_financed_share),
            top_financing_type_code=stats.top_financing_type_code,
            median_construction_year=stats.median_construction_year,
            last_sale_month=_month(last) if (wide and last) else None,
            last_sale_year=last.year if last else None,
            refreshed_at=stats.refreshed_at,
        )


def _area(value: Decimal | None, precise: bool) -> int | None:
    if value is None:
        return None
    step = 1 if precise else AREA_STEP_SMALL_GROUP
    return int((value / step).quantize(Decimal(1), rounding=ROUND_HALF_UP)) * step


def _pct(share: Decimal | None) -> int | None:
    if share is None:
        return None
    return int((share * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _month(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"
