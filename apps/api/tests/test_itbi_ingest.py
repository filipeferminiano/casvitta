"""ITBI ingestion: layouts per tab, typed parsing, raw storage and idempotent re-ingestion."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import load_workbook
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.market_data.models import (
    IptuUseCode,
    ItbiIngestionRun,
    ItbiTransactionRaw,
    RunStatus,
)
from app.domains.market_data.pipeline import run_ingestion
from app.integrations.itbi.layouts import (
    ItbiLayoutError,
    Layout,
    check_headerless,
    detect_layout,
    parse_row,
)
from app.integrations.itbi.local import LocalFileItbiSource
from app.integrations.itbi.port import payment_month
from tests.itbi_workbooks import HEADERS, row, write_workbook


@pytest.mark.parametrize(
    ("layout", "expected"),
    [("padrao", Layout.PADRAO), ("pardao", Layout.PARDAO), ("acc_acc", Layout.ACC_ACC)],
)
def test_detects_each_header_layout(layout: str, expected: Layout) -> None:
    assert detect_layout(HEADERS[layout]) is expected


def test_headerless_tab_is_detected_and_type_checked() -> None:
    data = [row(), row(sql=98_765_432.0)]
    assert detect_layout(data[0]) is Layout.HEADERLESS
    check_headerless(data)
    with pytest.raises(ItbiLayoutError):
        check_headerless([[123.0, "R X", "", "", "", "", "", "sem natureza", "", "sem data"]])


def test_unknown_headers_fail_loudly() -> None:
    renamed = list(HEADERS["padrao"])
    renamed[8] = "Valor"
    with pytest.raises(ItbiLayoutError, match="col 8"):
        detect_layout(renamed)
    with pytest.raises(ItbiLayoutError, match="26-27"):
        detect_layout([*HEADERS["padrao"][:26], "NOVA COLUNA", "ACC (IPTU)"])
    with pytest.raises(ItbiLayoutError, match="extra"):
        detect_layout([*HEADERS["padrao"], "OUTRA"])


def test_parse_row_types_and_padding() -> None:
    parsed = parse_row(
        row(
            sql=100_800_297.0,
            cep=1_103_020.0,
            value=1_349_864.78,
            proportion=0.64,
            nature="17.Resolução da alienação fiduciária",
            financing="1.Sistema Financeiro de Habitação",
            financed=1_000_000.5,
            when=date(2025, 12, 30),
        )
    )
    assert parsed.sql == "00100800297"
    assert (parsed.setor, parsed.quadra) == ("001", "008")
    assert parsed.cep == "01103020"
    assert parsed.value_cents == 134_986_478
    assert parsed.proportion_pct == Decimal("0.64")  # a percent: 0.64 %, not 64 %
    assert parsed.nature_code == 17
    assert parsed.financing_type_code == 1
    assert parsed.financed_value_cents == 100_000_050
    assert parsed.transaction_date == date(2025, 12, 30)
    assert parsed.construction_year == 2001
    assert not hasattr(parsed, "registry_number")


def test_parse_row_tolerates_bad_cells() -> None:
    cells = row()
    cells[8] = "n/d"
    cells[9] = "31/02/2026"
    cells[27] = 0.0
    parsed = parse_row(cells)
    assert parsed.value_cents is None
    assert parsed.transaction_date is None
    assert parsed.construction_year is None


@pytest.mark.parametrize(
    ("tab", "expected"),
    [
        ("JAN-2026", date(2026, 1, 1)),
        ("SET-2026", date(2026, 9, 1)),
        ("dez-2019", date(2019, 12, 1)),
        ("LEGENDA", None),
        ("Tabela de USOS", None),
        ("XYZ-2026", None),
    ],
)
def test_payment_month_comes_from_the_tab_name(tab: str, expected: date | None) -> None:
    assert payment_month(tab) == expected


def _fixture_folder(tmp_path: Path) -> Path:
    write_workbook(
        tmp_path / "GUIAS_DE_ITBI_PAGAS_(2019).xlsx",  # name says 2019; tabs say 2025
        {
            "NOV-2025": ("acc_acc", [row(sql=1.0), [None], row(sql=2.0)]),
            "DEZ-2025": ("headerless", [row(sql=3.0)]),
        },
    )
    write_workbook(
        tmp_path / "GUIAS DE ITBI PAGAS (03112026).xlsx",
        {
            "JAN-2026": ("padrao", [row(sql=4.0), row(sql=1.0)]),  # same row as in NOV: same hash
            "FEV-2026": ("pardao", [row(sql=5.0, when=date(2026, 2, 2))]),
        },
    )
    return tmp_path


async def test_ingestion_stores_raw_rows_once(tmp_path: Path, session: AsyncSession) -> None:
    source = LocalFileItbiSource(_fixture_folder(tmp_path))
    first = await run_ingestion(session, "sao-paulo", source, persist_raw=True)

    tabs = {t.tab: t for t in first.ingest.tabs}
    assert {t: (r.layout, r.rows) for t, r in tabs.items()} == {
        "NOV-2025": ("acc_acc", 2),
        "DEZ-2025": ("headerless", 1),
        "JAN-2026": ("padrao", 2),
        "FEV-2026": ("pardao", 1),
    }
    assert tabs["NOV-2025"].blank == 1
    assert first.run.status is RunStatus.SUCCEEDED
    assert first.run.data_through == date(2026, 2, 1)
    assert first.run.report["raw_inserted"] == 5  # the republished row is stored once
    raw_count = select(func.count()).select_from(ItbiTransactionRaw)
    assert await session.scalar(raw_count) == 5
    stored = await session.scalar(
        select(ItbiTransactionRaw).where(ItbiTransactionRaw.source_tab == "DEZ-2025")
    )
    assert stored is not None
    assert (stored.sql, stored.cep, stored.row_number) == ("00000000003", "04000001", 1)
    assert tabs["NOV-2025"].raw_inserted == 2 and tabs["JAN-2026"].raw_inserted == 1
    assert await session.scalar(select(IptuUseCode.description).where(IptuUseCode.code == 24))

    second = await run_ingestion(session, "sao-paulo", source, persist_raw=True)
    assert second.run.report["raw_inserted"] == 0
    assert await session.scalar(raw_count) == 5
    runs = select(func.count()).select_from(ItbiIngestionRun)
    assert await session.scalar(runs) == 2


async def test_ingestion_without_raw_copy(tmp_path: Path, session: AsyncSession) -> None:
    source = LocalFileItbiSource(_fixture_folder(tmp_path))
    result = await run_ingestion(session, "sao-paulo", source, persist_raw=False)
    assert result.ingest.rows_read == 6
    assert await session.scalar(select(func.count()).select_from(ItbiTransactionRaw)) == 0


async def test_a_tab_with_unknown_headers_fails_the_run(
    tmp_path: Path, session: AsyncSession
) -> None:
    bad = list(HEADERS["padrao"])
    bad[4] = "Distrito"
    path = tmp_path / "novo.xlsx"
    write_workbook(path, {"MAR-2026": ("padrao", [row()])})
    workbook = load_workbook(path)
    workbook["MAR-2026"]["E1"] = bad[4]
    workbook.save(path)
    with pytest.raises(ItbiLayoutError):
        await run_ingestion(session, "sao-paulo", LocalFileItbiSource(tmp_path), persist_raw=True)
    status = await session.scalar(select(ItbiIngestionRun.status))
    assert status is RunStatus.FAILED
