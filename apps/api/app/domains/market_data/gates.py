"""Privacy and quality gates: the only way a number leaves the market-data domain.

- An entity page shows numbers only when its gate passes (neighborhood: 30 sales in 12 months;
  street: 10 in 36 months; building: 5 in all history; all configurable). Below the page gate
  only counts may appear.
- Every published price (median, R$/m², ranges, area bands, monthly points, comparable groups,
  changes) needs ``market_min_price_group`` (10) sales without quality flags behind it; below
  that a block shows its sales count only ("poucas vendas registradas").
- Ranges (p25/p75 price and area) need ``market_min_for_ranges`` sales. The month of the last
  sale is never published; the year is.
- Values round to R$ 1.000, prices per m² to R$ 10, shares to whole percent.
- Never published: individual sales, SQL, unit, registry data, exact dates, reference values.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.core.settings import Settings
from app.domains.market_data.models import MarketStats, StatsEntity
from app.domains.market_data.schemas import PublicStats
from app.domains.market_data.stats import round_to

AREA_STEP_SMALL_GROUP = 5  # m²: below the ranges threshold the median area rounds to 5 m²


@dataclass(frozen=True, slots=True)
class Gates:
    neighborhood_12m: int
    street_36m: int
    building_all: int
    price_group: int
    ranges: int
    round_value_cents: int
    round_price_m2_cents: int

    @classmethod
    def from_settings(cls, settings: Settings) -> Gates:
        return cls(
            neighborhood_12m=settings.market_min_neighborhood_12m,
            street_36m=settings.market_min_street_36m,
            building_all=settings.market_min_building_all,
            price_group=settings.market_min_price_group,
            ranges=settings.market_min_for_ranges,
            round_value_cents=settings.market_round_value_cents,
            round_price_m2_cents=settings.market_round_price_m2_cents,
        )

    def page_threshold(self, entity: StatsEntity) -> tuple[str, int]:
        """(window that decides the gate, minimum sales) for an entity page."""
        return {
            StatsEntity.NEIGHBORHOOD: ("last_12m", self.neighborhood_12m),
            StatsEntity.STREET: ("last_36m", self.street_36m),
            StatsEntity.BUILDING: ("all", self.building_all),
        }[entity]

    def page_passes(self, entity: StatsEntity, gate_stats: MarketStats | None) -> bool:
        _, minimum = self.page_threshold(entity)
        return gate_stats is not None and gate_stats.median_sample >= minimum

    def value(self, cents: int | None) -> int | None:
        return None if cents is None else round_to(cents, self.round_value_cents)

    def price_m2(self, cents: int | None) -> int | None:
        return None if cents is None else round_to(cents, self.round_price_m2_cents)

    def priced(self, sample: int) -> bool:
        """Whether a group's median may be published."""
        return sample >= self.price_group

    def publish(self, stats: MarketStats | None, min_count: int) -> PublicStats | None:
        """Rounded, gated numbers for one entity × kind × window.

        None below ``min_count`` sales. Between that and the price group: the count only.
        """
        if stats is None or stats.tx_count < min_count:
            return None
        if not self.priced(stats.median_sample):
            return PublicStats(
                sales=stats.tx_count,
                window=stats.window,
                window_start=stats.window_start,
                window_end=stats.window_end,
                priced=False,
                last_sale_year=stats.last_transaction_month.year
                if stats.last_transaction_month
                else None,
                refreshed_at=stats.refreshed_at,
            )
        wide = stats.median_sample >= self.ranges
        last = stats.last_transaction_month
        return PublicStats(
            priced=True,
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
