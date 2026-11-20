"""Fabricated market data for development, Storybook-like demos and end-to-end tests.

    uv run python -m app.scripts.seed_market_demo

Writes a fictitious ITBI workbook (real headers, invented rows: fictitious streets and buildings,
deterministic values) and runs it through the real pipeline. The city is flagged ``is_demo`` so
every page shows "Demonstrativo" (CLAUDE.md rule 7). Refuses to touch a city with real data.
Needs the dev dependency openpyxl.
"""

from __future__ import annotations

import asyncio
import random
import sys
import tempfile
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_sessionmaker
from app.domains.market_data.models import MarketCity
from app.domains.market_data.pipeline import RunResult, run_ingestion
from app.integrations.itbi.layouts import COMMON_HEADERS, TAIL_HEADERS, Layout
from app.integrations.itbi.local import LocalFileItbiSource
from app.integrations.itbi.port import payment_month

DATA_THROUGH = date(2026, 9, 1)  # newest payment month of the demo workbook

# (neighborhood as in the source, CEP, street, number, building reference, sales in 12 months)
DEMO_BUILDINGS: tuple[tuple[str, int, str, int, str, int], ...] = (
    ("VL MARIANA", 4_101_001, "R DAS ACACIAS FICTICIAS", 120, "COND RESERVA DEMONSTRATIVA", 8),
    ("VL MARIANA", 4_101_001, "R DAS ACACIAS FICTICIAS", 300, "ED TORRE EXEMPLO", 6),
    ("VL MARIANA", 4_101_002, "AV DOS IPES FICTICIOS", 45, "COND JARDIM EXEMPLO", 14),
    ("VL MARIANA", 4_101_002, "AV DOS IPES FICTICIOS", 90, "ED POUCOS DADOS", 2),
    ("", 4_101_002, "AV DOS IPES FICTICIOS", 200, "", 26),  # empty Bairro: CEP vote
    ("MOEMA", 4_501_001, "AL DAS PALMEIRAS FICTICIAS", 10, "COND MOEMA EXEMPLO", 36),
    ("ACLIMACAO", 1_501_001, "R DOS CEDROS FICTICIOS", 77, "ED ACLIMACAO EXEMPLO", 4),
)


def _cells(
    rng: random.Random,
    *,
    sql: int,
    street: str,
    number: int,
    neighborhood: str,
    reference: str,
    cep: int,
    when: date,
) -> list[object]:
    area = rng.choice((55, 62, 68, 75, 90, 110))
    price_m2 = rng.randint(9_000, 14_000)
    value = round(area * price_m2, -3)
    financed = rng.random() < 0.6
    reference_value = value * 0.7
    cells: list[object] = [
        float(sql),
        street,
        float(number),
        f"AP {rng.randint(1, 20)}{rng.randint(1, 4)}",
        neighborhood,
        reference,
        float(cep),
        "1.Compra e venda",
        float(value),
        when,
        reference_value,
        100.0,
        reference_value,
        float(value),
        "1.Sistema Financeiro de Habitação" if financed else "",
        float(round(value * 0.7, -3)) if financed else 0.0,
        "CARTORIO FICTICIO",
        0.0,
        "Ativo Predial",
        1_000.0,
        12.0,
        0.01,
        float(area),
        20.0,
        "APARTAMENTO EM CONDOMÍNIO (EXIGE FRAÇÃO IDEAL)",
        22.0,
        "RESIDENCIAL VERTICAL",
        float(rng.choice((1998, 2005, 2012))),
    ]
    return cells


def write_demo_workbook(folder: Path) -> Path:
    from openpyxl import Workbook  # noqa: PLC0415 - dev dependency, imported only here

    rng = random.Random(20261120)  # noqa: S311 - deterministic fake data, not security
    header = [*COMMON_HEADERS, *TAIL_HEADERS[Layout.PADRAO]]
    tabs: dict[str, list[list[object]]] = {}
    months = ("SET-2025", "DEZ-2025", "MAR-2026", "JUN-2026", "AGO-2026", "SET-2026")
    block = 100
    for neighborhood, cep, street, number, reference, sales in DEMO_BUILDINGS:
        block += 1
        for i in range(sales):
            tab = months[i % len(months)]
            paid = payment_month(tab) or DATA_THROUGH
            when = paid.replace(day=1 + i % 25)
            if when > date(2026, 8, 31):  # paid in SET-2026 for a deed in August
                when = date(2026, 8, 20)
            sql = block * 10_000_000 + 200 * 10_000 + i * 10 + 1
            tabs.setdefault(tab, []).append(
                _cells(
                    rng,
                    sql=sql,
                    street=street,
                    number=number,
                    neighborhood=neighborhood,
                    reference=reference,
                    cep=cep,
                    when=when,
                )
            )
    workbook = Workbook()
    workbook.remove(workbook.active)
    for name in months:
        sheet = workbook.create_sheet(name)
        sheet.append(header)
        for cells in tabs.get(name, []):
            sheet.append(cells)
    path = folder / "GUIAS DE ITBI PAGAS (DEMONSTRATIVO).xlsx"
    workbook.save(path)
    return path


async def seed_demo(session: AsyncSession, city_slug: str = "sao-paulo") -> RunResult:
    city = await session.scalar(select(MarketCity).where(MarketCity.slug == city_slug))
    if city is not None and not city.is_demo:
        raise RuntimeError(f"{city_slug} has real market data; the demo seed will not touch it")
    with tempfile.TemporaryDirectory() as tmp:
        write_demo_workbook(Path(tmp))
        result = await run_ingestion(
            session, city_slug, LocalFileItbiSource(Path(tmp)), persist_raw=False
        )
    result.city.is_demo = True
    await session.commit()
    return result


async def main() -> int:
    async with get_sessionmaker()() as session:
        result = await seed_demo(session)
    print(f"Demo market data: {result.report['kept']} fictitious sales, flagged is_demo.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
