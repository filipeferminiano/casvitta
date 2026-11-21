"""Public market-data payloads. Everything here is already gated and rounded (see gates.py)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class PublicStats(BaseModel):
    """``priced`` false: the group is below MARKET_MIN_PRICE_GROUP, only the count is public."""

    sales: int
    window: str
    window_start: date | None
    window_end: date
    priced: bool = True
    median_value_cents: int | None = None
    median_price_m2_cents: int | None = None  # per m² of IPTU built area (common areas included)
    p25_price_m2_cents: int | None = None
    p75_price_m2_cents: int | None = None
    median_built_area_m2: int | None = None
    p25_built_area_m2: int | None = None
    p75_built_area_m2: int | None = None
    financed_pct: int | None = None
    median_financed_pct: int | None = None
    top_financing_type_code: int | None = None
    median_construction_year: int | None = None
    last_sale_year: int | None = None  # the month of a sale is never published
    # Change vs. the previous 12 months; only when both windows pass the price group.
    median_price_m2_change_12m_pct: Decimal | None = None
    sales_change_12m_pct: Decimal | None = None
    refreshed_at: datetime


class SourceInfo(BaseModel):
    """'Fonte: Prefeitura de São Paulo — guias de ITBI · Atualizado em dd/MM/yyyy'."""

    refreshed_at: datetime | None
    data_through: date | None  # newest payment month in the source
    window_end: date | None  # rolling windows end here (reporting lag)
    is_demo: bool = False  # fabricated data: the page shows "Demonstrativo"


class PlaceRef(BaseModel):
    slug: str
    name: str
    path: str  # site path of its page, e.g. "/preco-m2/sao-paulo/vila-mariana"
    # Neighborhoods only: the name with its preposition ("na Vila Mariana", "em Moema").
    in_name: str | None = None


class GateInfo(BaseModel):
    passes: bool
    indexable: bool  # passes AND the neighborhood is flagged indexable
    min_sales: int
    window: str


class NeighborhoodRow(BaseModel):
    place: PlaceRef
    zone: str | None
    indexable: bool
    stats: PublicStats | None  # last 12 months, all kinds; None below the gate


class StreetRow(BaseModel):
    place: PlaceRef
    stats: PublicStats | None


class BuildingRow(BaseModel):
    place: PlaceRef
    street_name: str
    street_number: int
    construction_year: int | None = None
    stats: PublicStats | None  # all history


class MonthlyPoint(BaseModel):
    month: str  # "2026-07"
    sales: int
    median_price_m2_cents: int | None
    # Median of the 12 months ending in this month: the chart's line.
    rolling_median_price_m2_cents: int | None = None


class AreaBand(BaseModel):
    band: str
    min_m2: int
    max_m2: int | None
    sales: int
    priced: bool = False
    median_value_cents: int | None
    median_price_m2_cents: int | None = None


class YearCount(BaseModel):
    """Sales in a calendar year: a count, never prices or dates."""

    year: int
    sales: int
    partial_until: date | None  # set for the current, incomplete year


class PriceComparison(BaseModel):
    """R$/m² (IPTU) over all history; each side only when it passes the price group."""

    building_price_m2_cents: int | None
    street_price_m2_cents: int | None
    neighborhood_price_m2_cents: int | None
    vs_neighborhood_pct: Decimal | None


class FinancedYear(BaseModel):
    year: int
    financed_pct: int
    partial_until: date | None


class NeighborIncome(BaseModel):
    place: PlaceRef
    median_value_cents: int
    min_income_cents: int  # same assumptions as the page (SAC first installment)


class FinancingContext(BaseModel):
    year: int
    financed_pct: int
    median_financed_pct: int | None
    top_financing_type_code: int | None


class CityIndexPage(BaseModel):
    city: PlaceRef
    source: SourceInfo
    stats: PublicStats | None  # the whole city, last 12 months, with changes
    neighborhoods_with_price: int
    neighborhoods: list[NeighborhoodRow]


class NeighborhoodPage(BaseModel):
    kind: Literal["neighborhood"] = "neighborhood"
    city: PlaceRef
    neighborhood: PlaceRef
    gate: GateInfo
    source: SourceInfo
    stats: PublicStats | None  # last 12 months, all kinds, with changes
    sales_12m: int  # shown even below the gate ("6 vendas")
    price_m2_change_5y_pct: Decimal | None
    monthly: list[MonthlyPoint]
    area_bands: list[AreaBand]
    top_streets: list[StreetRow]
    top_buildings: list[BuildingRow]
    neighbors: list[NeighborhoodRow]
    financing: FinancingContext | None


class StreetPage(BaseModel):
    kind: Literal["street"] = "street"
    city: PlaceRef
    neighborhood: PlaceRef
    street: PlaceRef
    gate: GateInfo
    source: SourceInfo
    stats: PublicStats | None  # last 36 months, all kinds
    sales_36m: int
    last_12m: PublicStats | None
    sales_by_year: list[YearCount]
    buildings: list[BuildingRow]
    similar_streets: list[StreetRow]


class BuildingPage(BaseModel):
    kind: Literal["building"] = "building"
    city: PlaceRef
    neighborhood: PlaceRef
    street: PlaceRef
    building: PlaceRef
    street_number: int
    construction_year: int | None
    gate: GateInfo
    source: SourceInfo
    stats: PublicStats | None  # all history
    sales: int
    last_24m: PublicStats | None
    sales_by_year: list[YearCount]
    comparison: PriceComparison | None
    street_stats: PublicStats | None  # fallback numbers when the building has few sales
    other_buildings: list[BuildingRow]


class Simulation(BaseModel):
    system: Literal["sac", "price"]
    property_price_cents: int
    down_payment_cents: int
    fgts_cents: int
    principal_cents: int
    term_months: int
    annual_rate_bps: int
    first_payment_cents: int
    last_payment_cents: int
    total_interest_cents: int
    min_income_cents: int  # first payment / max income commitment


class FinancingPage(BaseModel):
    kind: Literal["financing"] = "financing"
    city: PlaceRef
    neighborhood: PlaceRef
    gate: GateInfo
    source: SourceInfo
    property_kind: Literal["apartment", "all"]
    median_value_cents: int | None
    down_payment_pct: int
    term_months: int
    annual_rate_bps: int
    max_income_commitment_pct: int
    min_down_payment_pct: int
    simulations: list[Simulation]
    financing: FinancingContext | None
    financed_by_year: list[FinancedYear]
    neighbors: list[NeighborIncome]


class Redirect(BaseModel):
    kind: Literal["redirect"] = "redirect"
    path: str


class SitemapEntry(BaseModel):
    path: str
    last_modified: datetime | None


class Sitemap(BaseModel):
    template: Literal["bairros", "ruas", "condominios", "financiamento"]
    entries: list[SitemapEntry]
