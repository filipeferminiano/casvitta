"""Aggregate math: windows with the reporting lag, medians without flagged rows, bands, series."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.market_data.aggregate import (
    MIN_MONTHLY_SAMPLE,
    area_bands,
    compute_monthly,
    compute_stats,
    summarize,
    window_end,
    windows,
)
from app.domains.market_data.clean import CleanRow
from app.domains.market_data.models import MarketMonthly, MarketStats, PropertyKind, StatsEntity
from app.domains.market_data.pipeline import run_ingestion
from app.domains.market_data.places import LocatedRow
from app.integrations.itbi.local import LocalFileItbiSource
from tests.itbi_workbooks import row, write_workbook


def clean_row(
    value: int = 50_000_000,
    area: str = "100",
    when: date = date(2026, 3, 10),
    *,
    kind: PropertyKind = PropertyKind.APARTMENT,
    financed: int | None = None,
    financing_type: int | None = None,
    year: int | None = 2001,
    under_declared: bool = False,
    outlier: bool = False,
) -> CleanRow:
    built = Decimal(area)
    return CleanRow(
        row_hash=uuid.uuid4().hex,
        sql="00400200010",
        street_key="R X",
        street_number=10,
        cep="04000001",
        neighborhood_raw="",
        reference_raw="",
        kind=kind,
        transaction_date=when,
        payment_month=when.replace(day=1),
        value_cents=value,
        built_area_m2=built,
        price_m2_cents=int(Decimal(value) / built),
        financing_type_code=financing_type,
        financed_value_cents=financed,
        construction_year=year,
        under_declared=under_declared,
        bundled_parking=False,
        price_outlier=outlier,
    )


def test_window_end_lags_behind_the_newest_payment_month() -> None:
    # Payments through SET-2026, lag 1 month: rolling windows end on 31/08/2026.
    assert window_end(date(2026, 9, 1), 1) == date(2026, 8, 31)
    assert window_end(date(2026, 1, 1), 1) == date(2025, 12, 31)
    assert window_end(date(2026, 9, 1), 0) == date(2026, 9, 30)


def test_windows() -> None:
    by_key = {w.key: w for w in windows(date(2026, 8, 31))}
    assert (by_key["last_12m"].start, by_key["last_12m"].end) == (
        date(2025, 9, 1),
        date(2026, 8, 31),
    )
    assert by_key["last_24m"].start == date(2024, 9, 1)
    assert by_key["all"].start is None
    assert (by_key["y2026"].start, by_key["y2026"].end) == (date(2026, 1, 1), date(2026, 8, 31))
    assert by_key["y2019"].end == date(2019, 12, 31)
    assert "y2018" not in by_key and "y2027" not in by_key


def test_summarize_excludes_flagged_rows_from_medians_only() -> None:
    rows = [
        clean_row(40_000_000, "80", date(2026, 1, 5)),
        clean_row(60_000_000, "100", date(2026, 2, 5), financed=30_000_000, financing_type=1),
        clean_row(80_000_000, "100", date(2026, 3, 5), financed=60_000_000, financing_type=2),
        clean_row(1_000_000, "100", date(2026, 4, 5), under_declared=True, financing_type=1),
        clean_row(900_000_000, "100", date(2026, 5, 20), outlier=True, year=None),
    ]
    stats = summarize(rows)
    assert stats["tx_count"] == 5
    assert stats["median_sample"] == 3
    assert stats["median_value_cents"] == 60_000_000
    assert stats["median_price_m2_cents"] == 600_000  # R$ 6.000 per built m²
    assert stats["p25_price_m2_cents"] == 550_000
    assert stats["p75_price_m2_cents"] == 700_000
    assert stats["median_built_area_m2"] == Decimal("100")
    assert stats["financed_share"] == Decimal("0.6000")  # 3 of 5 declared financing
    assert stats["median_financed_share"] == Decimal("0.6250")  # median of 0.5 and 0.75
    assert stats["top_financing_type_code"] == 1
    assert stats["median_construction_year"] == 2001
    assert stats["last_transaction_month"] == date(2026, 5, 1)  # month only


def test_area_bands() -> None:
    rows = [clean_row(area="45"), clean_row(area="65"), clean_row(area="65"), clean_row(area="200")]
    bands = {b["band"]: b for b in area_bands(rows)}
    assert [bands[k]["tx_count"] for k in ("ate-50", "50-70", "70-100", "150-mais")] == [1, 2, 0, 1]
    assert bands["70-100"]["median_value_cents"] is None


def test_compute_stats_windows_and_kinds() -> None:
    neighborhood, street = uuid.uuid4(), uuid.uuid4()
    rows = [
        LocatedRow(clean_row(when=date(2026, 3, 1)), "x", neighborhood, street, None),
        LocatedRow(
            clean_row(when=date(2021, 3, 1), kind=PropertyKind.HOUSE), "x", neighborhood, street
        ),
        # After the window end: ignored.
        LocatedRow(clean_row(when=date(2026, 9, 2)), "x", neighborhood, street),
    ]
    stats = compute_stats(uuid.uuid4(), rows, date(2026, 8, 31), datetime.now(UTC))
    keys = {(s["entity_type"], s["kind"], s["window"]): s["tx_count"] for s in stats}
    assert keys[(StatsEntity.NEIGHBORHOOD, "all", "all")] == 2
    assert keys[(StatsEntity.NEIGHBORHOOD, "apartment", "last_12m")] == 1
    assert keys[(StatsEntity.NEIGHBORHOOD, "house", "y2021")] == 1
    assert (StatsEntity.STREET, "all", "y2021") not in keys  # streets: rolling windows only
    assert keys[(StatsEntity.STREET, "all", "last_24m")] == 1


def test_monthly_series_hides_small_months() -> None:
    neighborhood = uuid.uuid4()
    rows = [
        LocatedRow(clean_row(when=date(2026, 3, d + 1)), "x", neighborhood)
        for d in range(MIN_MONTHLY_SAMPLE)
    ]
    rows.append(LocatedRow(clean_row(when=date(2026, 4, 2)), "x", neighborhood))
    series = {(m["kind"], m["month"]): m for m in compute_monthly(rows, date(2026, 8, 31))}
    assert series[("all", date(2026, 3, 1))]["median_price_m2_cents"] == 500_000
    assert series[("all", date(2026, 4, 1))]["median_price_m2_cents"] is None
    assert series[("all", date(2026, 4, 1))]["tx_count"] == 1


async def test_refresh_writes_aggregates(tmp_path: Path, session: AsyncSession) -> None:
    write_workbook(
        tmp_path / "a.xlsx",
        {
            "SET-2026": (
                "padrao",
                [
                    row(sql=float(4_202_000 + i), neighborhood="VL MARIANA", when=date(2026, 7, 1))
                    for i in range(3)
                ],
            )
        },
    )
    result = await run_ingestion(
        session, "sao-paulo", LocalFileItbiSource(tmp_path), persist_raw=False
    )
    assert result.report["window_end"] == "2026-08-31"
    stats = (
        await session.scalars(
            select(MarketStats).where(
                MarketStats.entity_type == StatsEntity.NEIGHBORHOOD,
                MarketStats.window == "last_12m",
                MarketStats.kind == "all",
            )
        )
    ).all()
    assert [s.tx_count for s in stats] == [3]
    assert await session.scalar(select(MarketMonthly.tx_count)) == 3
