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
    proportion_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4))
    reference_value_prop_cents: Mapped[int | None] = mapped_column(BigInteger)
    tax_base_cents: Mapped[int | None] = mapped_column(BigInteger)
    financing_type_code: Mapped[int | None] = mapped_column(SmallInteger)
    financed_value_cents: Mapped[int | None] = mapped_column(BigInteger)
    sql_status: Mapped[str] = mapped_column(String())
    land_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    frontage_m: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    ideal_fraction: Mapped[Decimal | None] = mapped_column(Numeric(12, 8))
    built_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    use_code: Mapped[int | None] = mapped_column(SmallInteger)
    standard_code: Mapped[int | None] = mapped_column(SmallInteger)
    construction_year: Mapped[int | None] = mapped_column(SmallInteger)
