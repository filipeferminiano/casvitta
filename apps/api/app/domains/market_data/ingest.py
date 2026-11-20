"""Streams ITBI tabs into typed rows, reports per file and tab, and (optionally) stores raw rows."""

from __future__ import annotations

import uuid
from collections.abc import Iterator, Sequence
from dataclasses import asdict, dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.domains.market_data.models import (
    IptuStandardCode,
    IptuUseCode,
    ItbiTransactionRaw,
    MarketCity,
)
from app.integrations.itbi.layouts import (
    ItbiRow,
    Layout,
    check_headerless,
    detect_layout,
    is_blank,
    parse_row,
)
from app.integrations.itbi.port import ItbiSource, ItbiTab

log = get_logger(__name__)

RAW_BATCH = 1_000  # rows per INSERT (about 30 parameters each; Postgres allows 32,767)


@dataclass(slots=True)
class TabReport:
    file: str
    tab: str
    payment_month: str
    layout: str
    rows: int = 0
    blank: int = 0
    raw_inserted: int = 0


@dataclass(slots=True)
class IngestReport:
    tabs: list[TabReport] = field(default_factory=list)

    @property
    def rows_read(self) -> int:
        return sum(t.rows for t in self.tabs)

    @property
    def data_through(self) -> date | None:
        months = [date.fromisoformat(t.payment_month) for t in self.tabs]
        return max(months) if months else None

    def as_dict(self) -> dict[str, object]:
        return {
            "rows_read": self.rows_read,
            "raw_inserted": sum(t.raw_inserted for t in self.tabs),
            "data_through": self.data_through.isoformat() if self.data_through else None,
            "tabs": [asdict(t) for t in self.tabs],
        }


@dataclass(frozen=True, slots=True)
class SourceRow:
    file: str
    tab: str
    payment_month: date
    row_number: int  # 1-based, as in the spreadsheet
    row: ItbiRow


def iter_rows(source: ItbiSource, report: IngestReport) -> Iterator[SourceRow]:
    """Typed rows of every monthly tab. Fails loudly on a tab with an unknown layout."""
    for tab in source.tabs():
        yield from _tab_rows(tab, report)


def _tab_rows(tab: ItbiTab, report: IngestReport) -> Iterator[SourceRow]:
    if not tab.rows:
        return
    layout = detect_layout(tab.rows[0])
    first = 0 if layout is Layout.HEADERLESS else 1
    if layout is Layout.HEADERLESS:
        check_headerless(tab.rows)
    tab_report = TabReport(tab.source_file, tab.tab, tab.payment_month.isoformat(), layout.value)
    report.tabs.append(tab_report)
    for index in range(first, len(tab.rows)):
        cells = tab.rows[index]
        if is_blank(cells):
            tab_report.blank += 1
            continue
        tab_report.rows += 1
        yield SourceRow(tab.source_file, tab.tab, tab.payment_month, index + 1, parse_row(cells))
    log.info("itbi_tab_read", file=tab.source_file, tab=tab.tab, rows=tab_report.rows)


async def store_raw(
    session: AsyncSession,
    city_id: uuid.UUID,
    run_id: uuid.UUID,
    rows: Sequence[SourceRow],
    report: IngestReport,
) -> int:
    """Insert rows not seen before (by row hash). Returns how many were new."""
    if not rows:
        return 0
    values = [_raw_values(city_id, run_id, r) for r in rows]
    statement = (
        insert(ItbiTransactionRaw)
        .values(values)
        .on_conflict_do_nothing(index_elements=["city_id", "row_hash"])
        .returning(ItbiTransactionRaw.source_tab, ItbiTransactionRaw.source_file)
    )
    inserted = (await session.execute(statement)).all()
    by_tab = {(t.file, t.tab): t for t in report.tabs}
    for tab_name, file_name in inserted:
        by_tab[(file_name, tab_name)].raw_inserted += 1
    return len(inserted)


def _raw_values(city_id: uuid.UUID, run_id: uuid.UUID, source: SourceRow) -> dict[str, object]:
    r = source.row
    return {
        "city_id": city_id,
        "run_id": run_id,
        "source_file": source.file,
        "source_tab": source.tab,
        "row_number": source.row_number,
        "payment_month": source.payment_month,
        "row_hash": r.row_hash,
        "sql": r.sql,
        "street_raw": r.street_raw,
        "street_number": r.street_number,
        "unit_raw": r.unit_raw,
        "neighborhood_raw": r.neighborhood_raw,
        "reference_raw": r.reference_raw,
        "cep": r.cep,
        "nature_code": r.nature_code,
        "value_cents": r.value_cents,
        "transaction_date": r.transaction_date,
        "reference_value_cents": r.reference_value_cents,
        "proportion_pct": r.proportion_pct,
        "reference_value_prop_cents": r.reference_value_prop_cents,
        "tax_base_cents": r.tax_base_cents,
        "financing_type_code": r.financing_type_code,
        "financed_value_cents": r.financed_value_cents,
        "sql_status": r.sql_status,
        "land_area_m2": r.land_area_m2,
        "frontage_m": r.frontage_m,
        "ideal_fraction": r.ideal_fraction,
        "built_area_m2": r.built_area_m2,
        "use_code": r.use_code,
        "standard_code": r.standard_code,
        "construction_year": r.construction_year,
    }


async def store_code_tables(
    session: AsyncSession, uses: dict[int, str], standards: dict[int, str]
) -> None:
    """Seed tables iptu_use_codes and iptu_standard_codes (upsert)."""
    for model, table in ((IptuUseCode, uses), (IptuStandardCode, standards)):
        if not table:
            continue
        statement = insert(model).values(
            [{"code": code, "description": text} for code, text in table.items()]
        )
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=["code"], set_={"description": statement.excluded.description}
            )
        )


CITIES = {"sao-paulo": ("São Paulo", "SP")}


async def get_or_create_city(session: AsyncSession, slug: str) -> MarketCity:
    city = await session.scalar(select(MarketCity).where(MarketCity.slug == slug))
    if city:
        return city
    if slug not in CITIES:
        raise ValueError(f"unknown city {slug!r}; known: {sorted(CITIES)}")
    name, uf = CITIES[slug]
    city = MarketCity(slug=slug, name=name, uf=uf)
    session.add(city)
    await session.flush()
    return city
