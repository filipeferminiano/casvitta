"""Market data from public sources (São Paulo ITBI). Platform-level reference data, not tenant data.

Every table carries ``city_id`` so another city is configuration, not a migration. Registry
number (matrícula) and registry office (cartório) are never stored (data minimization).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, str_enum

JSONType = JSON().with_variant(JSONB(), "postgresql")


class MarketCity(UUIDPrimaryKey, Timestamps, DemoFlag, Base):
    __tablename__ = "market_cities"

    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    uf: Mapped[str] = mapped_column(String(2))


class IptuUseCode(Base):
    __tablename__ = "iptu_use_codes"

    code: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False)
    description: Mapped[str] = mapped_column(String(200))


class IptuStandardCode(Base):
    __tablename__ = "iptu_standard_codes"

    code: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False)
    description: Mapped[str] = mapped_column(String(200))


class RunStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ItbiIngestionRun(UUIDPrimaryKey, Base):
    __tablename__ = "itbi_ingestion_runs"

    city_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_cities.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[RunStatus] = mapped_column(str_enum(RunStatus), default=RunStatus.RUNNING)
    persist_raw: Mapped[bool] = mapped_column(default=False)
    # Last payment month present in the source (the newest monthly tab).
    data_through: Mapped[date | None] = mapped_column(Date)
    report: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)


class ItbiTransactionRaw(Base):
    """One source row as published, typed, minus matrícula and cartório. Immutable.

    Idempotent on (city_id, row_hash): re-ingesting the same files inserts nothing.
    """

    __tablename__ = "itbi_transactions_raw"
    __table_args__ = (UniqueConstraint("city_id", "row_hash"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    city_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_cities.id", ondelete="CASCADE"))
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("itbi_ingestion_runs.id", ondelete="SET NULL"), nullable=True
    )
    source_file: Mapped[str] = mapped_column(String(160))
    source_tab: Mapped[str] = mapped_column(String(20))
    row_number: Mapped[int] = mapped_column()
    payment_month: Mapped[date] = mapped_column(Date)
    row_hash: Mapped[str] = mapped_column(String(64))
    sql: Mapped[str] = mapped_column(String(11))
    street_raw: Mapped[str] = mapped_column(String())
    street_number: Mapped[int | None] = mapped_column()
    unit_raw: Mapped[str] = mapped_column(String())
    neighborhood_raw: Mapped[str] = mapped_column(String())
    reference_raw: Mapped[str] = mapped_column(String())
    cep: Mapped[str] = mapped_column(String(8))
    nature_code: Mapped[int | None] = mapped_column(SmallInteger)
    value_cents: Mapped[int | None] = mapped_column(BigInteger)
    transaction_date: Mapped[date | None] = mapped_column(Date)
    reference_value_cents: Mapped[int | None] = mapped_column(BigInteger)
    proportion_pct: Mapped[Decimal | None] = mapped_column(Numeric(16, 4))
    reference_value_prop_cents: Mapped[int | None] = mapped_column(BigInteger)
    tax_base_cents: Mapped[int | None] = mapped_column(BigInteger)
    financing_type_code: Mapped[int | None] = mapped_column(SmallInteger)
    financed_value_cents: Mapped[int | None] = mapped_column(BigInteger)
    sql_status: Mapped[str] = mapped_column(String())
    land_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    frontage_m: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    ideal_fraction: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    built_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    use_code: Mapped[int | None] = mapped_column(SmallInteger)
    standard_code: Mapped[int | None] = mapped_column(SmallInteger)
    construction_year: Mapped[int | None] = mapped_column(SmallInteger)


# --- Places (normalization) ---------------------------------------------------------------------


class MarketNeighborhood(UUIDPrimaryKey, Timestamps, Base):
    """A neighborhood as people say it ("Vila Mariana"), not the official district."""

    __tablename__ = "market_neighborhoods"
    __table_args__ = (UniqueConstraint("city_id", "slug"),)

    city_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_cities.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(80))
    zone: Mapped[str | None] = mapped_column(String(20))
    # Canonical spellings seen in the source (no accents, abbreviations expanded).
    aliases: Mapped[list[str]] = mapped_column(JSONType, default=list)
    wave: Mapped[int | None] = mapped_column(SmallInteger)
    # "na" / "no" / "em": titles say "Preço do m² na Vila Mariana", "em Moema", "no Ipiranga".
    preposition: Mapped[str] = mapped_column(String(3), default="em", server_default="em")
    is_indexable: Mapped[bool] = mapped_column(default=False)
    # True when created from the data rather than from the curated seed.
    is_auto: Mapped[bool] = mapped_column(default=False)


class MarketNeighborhoodAdjacency(Base):
    __tablename__ = "market_neighborhood_adjacency"

    neighborhood_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_neighborhoods.id", ondelete="CASCADE"), primary_key=True
    )
    neighbor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_neighborhoods.id", ondelete="CASCADE"), primary_key=True
    )


class MarketStreet(UUIDPrimaryKey, Timestamps, Base):
    """A street within one neighborhood (a long street has one row per neighborhood)."""

    __tablename__ = "market_streets"
    __table_args__ = (
        UniqueConstraint("neighborhood_id", "slug", name="uq_market_streets_neighborhood_slug"),
        UniqueConstraint("neighborhood_id", "name_key", name="uq_market_streets_neighborhood_key"),
    )

    city_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_cities.id", ondelete="CASCADE"))
    neighborhood_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_neighborhoods.id", ondelete="CASCADE"), index=True
    )
    name_key: Mapped[str] = mapped_column(String(120))  # source spelling, normalized
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140))


class MarketBuilding(UUIDPrimaryKey, Timestamps, Base):
    """Units grouped by fiscal block (setor + quadra) + street + number."""

    __tablename__ = "market_buildings"
    __table_args__ = (
        UniqueConstraint("city_id", "building_key", name="uq_market_buildings_city_key"),
        UniqueConstraint("neighborhood_id", "slug", name="uq_market_buildings_neighborhood_slug"),
    )

    city_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_cities.id", ondelete="CASCADE"))
    neighborhood_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_neighborhoods.id", ondelete="CASCADE"), index=True
    )
    street_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_streets.id", ondelete="CASCADE"), index=True
    )
    building_key: Mapped[str] = mapped_column(String(160))
    street_number: Mapped[int] = mapped_column()
    name: Mapped[str] = mapped_column(String(160))
    has_named_reference: Mapped[bool] = mapped_column(default=False)
    slug: Mapped[str] = mapped_column(String(180))
    construction_year: Mapped[int | None] = mapped_column(SmallInteger)


class SlugEntity(StrEnum):
    NEIGHBORHOOD = "neighborhood"
    STREET = "street"
    BUILDING = "building"


class MarketSlugRedirect(UUIDPrimaryKey, Base):
    """An old slug of an entity under a parent (neighborhood); the page 301s to the current one."""

    __tablename__ = "market_slug_redirects"
    __table_args__ = (UniqueConstraint("entity_type", "parent_id", "old_slug"),)

    city_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_cities.id", ondelete="CASCADE"))
    entity_type: Mapped[SlugEntity] = mapped_column(str_enum(SlugEntity))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    # Neighborhood id for streets and buildings; city id for neighborhoods.
    parent_id: Mapped[uuid.UUID] = mapped_column()
    old_slug: Mapped[str] = mapped_column(String(180))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PropertyKind(StrEnum):
    APARTMENT = "apartment"  # IPTU use 20
    FLAT = "flat"  # IPTU use 25 (kept separate)
    HOUSE = "house"  # IPTU uses 10, 14


class ItbiTransaction(Base):
    """A cleaned, located purchase (nature 1, whole property, residential).

    Never published one by one: pages only show gated aggregates.
    """

    __tablename__ = "itbi_transactions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    city_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_cities.id", ondelete="CASCADE"), index=True
    )
    row_hash: Mapped[str] = mapped_column(String(64))
    neighborhood_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("market_neighborhoods.id", ondelete="SET NULL"), index=True
    )
    street_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("market_streets.id", ondelete="SET NULL"), index=True
    )
    building_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("market_buildings.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[PropertyKind] = mapped_column(str_enum(PropertyKind, length=16))
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    payment_month: Mapped[date] = mapped_column(Date)
    value_cents: Mapped[int] = mapped_column(BigInteger)
    # Base de cálculo adotada: max(value, proportional reference value); for estimated ITBI.
    tax_base_cents: Mapped[int | None] = mapped_column(BigInteger)
    built_area_m2: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_m2_cents: Mapped[int] = mapped_column(BigInteger)
    financing_type_code: Mapped[int | None] = mapped_column(SmallInteger)
    financed_value_cents: Mapped[int | None] = mapped_column(BigInteger)
    construction_year: Mapped[int | None] = mapped_column(SmallInteger)
    # Quality flags: kept, but excluded from medians.
    under_declared: Mapped[bool] = mapped_column(default=False)
    price_outlier: Mapped[bool] = mapped_column(default=False)
    # Kept and counted; the unit text mentions bundled parking ("VG", "VGS").
    bundled_parking: Mapped[bool] = mapped_column(default=False)


class ItbiLocationReview(UUIDPrimaryKey, Base):
    """Cleaned rows whose neighborhood could not be resolved, grouped by CEP and street."""

    __tablename__ = "itbi_location_review"

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("itbi_ingestion_runs.id", ondelete="CASCADE"), index=True
    )
    cep: Mapped[str] = mapped_column(String(8))
    street: Mapped[str] = mapped_column(String(120))
    row_count: Mapped[int] = mapped_column()


# --- Aggregates (rebuilt after each refresh) ----------------------------------------------------


class StatsEntity(StrEnum):
    CITY = "city"
    NEIGHBORHOOD = "neighborhood"
    STREET = "street"
    BUILDING = "building"


class MarketStats(UUIDPrimaryKey, Base):
    """Exact aggregates for one entity × kind × window. The API gates and rounds before publishing.

    ``kind`` is a PropertyKind value or "all". ``window`` is "last_12m", "last_24m", "all" or
    "y2026"; windows end at ``window_end`` (last complete payment month minus the lag).
    """

    __tablename__ = "market_stats"
    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_id", "kind", "window", name="uq_market_stats_entity_window"
        ),
    )

    city_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_cities.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[StatsEntity] = mapped_column(str_enum(StatsEntity, length=16))
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(16))
    window: Mapped[str] = mapped_column(String(16))
    window_start: Mapped[date | None] = mapped_column(Date)
    window_end: Mapped[date] = mapped_column(Date)
    tx_count: Mapped[int] = mapped_column()  # every cleaned sale, flagged ones included
    median_sample: Mapped[int] = mapped_column()  # sales used for medians (no quality flags)
    median_value_cents: Mapped[int | None] = mapped_column(BigInteger)
    median_price_m2_cents: Mapped[int | None] = mapped_column(BigInteger)
    p25_price_m2_cents: Mapped[int | None] = mapped_column(BigInteger)
    p75_price_m2_cents: Mapped[int | None] = mapped_column(BigInteger)
    median_built_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    p25_built_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    p75_built_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    financed_share: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    median_financed_share: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    top_financing_type_code: Mapped[int | None] = mapped_column(SmallInteger)
    median_construction_year: Mapped[int | None] = mapped_column(SmallInteger)
    last_transaction_month: Mapped[date | None] = mapped_column(Date)  # first day; never the day
    area_bands: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MarketMonthly(Base):
    """Monthly series per neighborhood × kind (chart): count and median price per built m²."""

    __tablename__ = "market_monthly"

    neighborhood_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_neighborhoods.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)
    month: Mapped[date] = mapped_column(Date, primary_key=True)
    tx_count: Mapped[int] = mapped_column()
    median_sample: Mapped[int] = mapped_column()
    median_price_m2_cents: Mapped[int | None] = mapped_column(BigInteger)
    # Median of the 12 months ending at ``month`` (the chart's line).
    rolling_sample: Mapped[int] = mapped_column(default=0, server_default="0")
    rolling_median_price_m2_cents: Mapped[int | None] = mapped_column(BigInteger)
