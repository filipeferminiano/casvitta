"""Public market-data payloads. Everything here is already gated and rounded (see gates.py)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class PublicStats(BaseModel):
    sales: int
    window: str
    window_start: date | None
    window_end: date
    median_value_cents: int | None
    median_price_m2_cents: int | None  # per m² of IPTU built area (common areas included)
    p25_price_m2_cents: int | None
    p75_price_m2_cents: int | None
    median_built_area_m2: int | None
    p25_built_area_m2: int | None
    p75_built_area_m2: int | None
    financed_pct: int | None
    median_financed_pct: int | None
    top_financing_type_code: int | None
    median_construction_year: int | None
    last_sale_month: str | None  # "2026-07"; only for groups with enough sales
    last_sale_year: int | None
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
    stats: PublicStats | None


class MonthlyPoint(BaseModel):
    month: str  # "2026-07"
    sales: int
    median_price_m2_cents: int | None


class AreaBand(BaseModel):
    band: str
    min_m2: int
    max_m2: int | None
    sales: int
    median_value_cents: int | None


class YearRow(BaseModel):
    year: int
    partial_until: date | None  # set for the current, incomplete year
    stats: PublicStats | None


class FinancingContext(BaseModel):
    year: int
    financed_pct: int
    median_financed_pct: int | None
    top_financing_type_code: int | None


class CityIndexPage(BaseModel):
    city: PlaceRef
    source: SourceInfo
    neighborhoods: list[NeighborhoodRow]


class NeighborhoodPage(BaseModel):
    kind: Literal["neighborhood"] = "neighborhood"
    city: PlaceRef
    neighborhood: PlaceRef
    gate: GateInfo
    source: SourceInfo
    stats: PublicStats | None  # last 12 months, all kinds
    apartments: PublicStats | None
    houses: PublicStats | None
    years: list[YearRow]
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
    stats: PublicStats | None  # last 24 months, all kinds
    last_12m: PublicStats | None
    apartments: PublicStats | None
    buildings: list[BuildingRow]


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
    last_24m: PublicStats | None


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
    simulations: list[Simulation]
    financing: FinancingContext | None


class Redirect(BaseModel):
    kind: Literal["redirect"] = "redirect"
    path: str


class SitemapEntry(BaseModel):
    path: str
    last_modified: datetime | None


class Sitemap(BaseModel):
    template: Literal["bairros", "ruas", "condominios", "financiamento"]
    entries: list[SitemapEntry]
