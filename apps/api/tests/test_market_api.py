"""Public price pages: gates, rounding, redirects, sitemaps and the privacy invariants.

Uses the fabricated demo dataset (app/scripts/seed_market_demo.py) through the real pipeline.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.finance import AmortizationSystem, simulate
from app.core.settings import get_settings
from app.domains.market_data.gates import Gates
from app.domains.market_data.models import (
    MarketBuilding,
    MarketSlugRedirect,
    MarketStats,
    SlugEntity,
    StatsEntity,
)
from app.scripts.seed_market_demo import seed_demo

BASE = "/v1/public/market/sao-paulo"
FORBIDDEN_KEYS = {
    "sql",
    "unit",
    "unit_raw",
    "complement",
    "registry_number",
    "registry_office",
    "matricula",
    "row_hash",
    "transaction_date",
    "reference_value_cents",
    "value_cents",
}


@pytest.fixture
async def demo(session: AsyncSession) -> None:
    await seed_demo(session)


def _keys(payload: Any) -> set[str]:
    if isinstance(payload, dict):
        return set(payload) | {k for v in payload.values() for k in _keys(v)}
    if isinstance(payload, list):
        return {k for item in payload for k in _keys(item)}
    return set()


async def _get(client: AsyncClient, path: str) -> dict[str, Any]:
    response = await client.get(f"{BASE}{path}")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    assert not (_keys(body) & FORBIDDEN_KEYS), _keys(body) & FORBIDDEN_KEYS
    return body


@pytest.mark.usefixtures("demo")
async def test_neighborhood_page_above_the_gate(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/vila-mariana")
    assert page["gate"] == {
        "passes": True,
        "indexable": True,
        "min_sales": 30,
        "window": "last_12m",
    }
    assert page["source"]["is_demo"] is True
    assert page["source"]["window_end"] == "2026-08-31"
    stats = page["stats"]
    assert stats["sales"] == 56  # 30 with Bairro + 26 located by their CEP
    assert stats["median_value_cents"] % 100_000 == 0  # R$ 1.000
    assert stats["median_price_m2_cents"] % 1_000 == 0  # R$ 10
    assert stats["p25_price_m2_cents"] is not None  # 42 sales: ranges allowed
    assert stats["last_sale_month"] == "2026-08"
    streets = [s["place"]["slug"] for s in page["top_streets"]]
    assert streets == ["avenida-dos-ipes-ficticios", "rua-das-acacias-ficticias"]
    buildings = {b["place"]["slug"] for b in page["top_buildings"]}
    assert "edificio-poucos-dados" not in buildings  # 2 sales: below the building gate
    assert "condominio-jardim-exemplo" in buildings
    neighbors = {n["place"]["slug"]: n for n in page["neighbors"]}
    assert neighbors["moema"]["stats"] is not None
    assert neighbors["aclimacao"]["stats"] is None
    assert len(page["monthly"]) >= 5
    assert page["financing"]["year"] == 2026


@pytest.mark.usefixtures("demo")
async def test_neighborhood_below_the_gate_shows_no_numbers(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/aclimacao")
    assert page["gate"]["passes"] is False
    assert page["gate"]["indexable"] is False
    for key in ("stats", "apartments", "houses", "financing"):
        assert page[key] is None
    for key in ("years", "monthly", "area_bands", "top_streets", "top_buildings"):
        assert page[key] == []
    assert page["neighbors"]  # links to the parent and neighbors still render


@pytest.mark.usefixtures("demo")
async def test_small_building_shows_median_only(client: AsyncClient) -> None:
    page = await _get(
        client, "/neighborhoods/vila-mariana/buildings/condominio-reserva-demonstrativa"
    )
    stats = page["stats"]
    assert page["gate"]["passes"] and stats["sales"] == 8
    assert stats["median_value_cents"] is not None
    assert stats["p25_price_m2_cents"] is None and stats["p75_price_m2_cents"] is None
    assert stats["p25_built_area_m2"] is None
    assert stats["median_built_area_m2"] % 5 == 0  # rounded to 5 m² in small groups
    assert stats["last_sale_month"] is None and stats["last_sale_year"] == 2026


@pytest.mark.usefixtures("demo")
async def test_building_with_enough_sales_shows_ranges(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/vila-mariana/buildings/condominio-jardim-exemplo")
    assert page["stats"]["sales"] == 14
    assert page["stats"]["p25_built_area_m2"] is not None
    assert page["construction_year"] in {1998, 2005, 2012}


@pytest.mark.usefixtures("demo")
async def test_building_below_the_gate_reveals_nothing(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/vila-mariana/buildings/edificio-poucos-dados")
    assert page["gate"]["passes"] is False
    assert page["stats"] is None and page["last_24m"] is None
    assert page["construction_year"] is None


@pytest.mark.usefixtures("demo")
async def test_street_page(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/vila-mariana/streets/avenida-dos-ipes-ficticios")
    assert page["gate"]["passes"]
    assert page["stats"]["sales"] == 42
    names = [b["place"]["name"] for b in page["buildings"]]
    assert "Edifício na Avenida dos Ipes Ficticios, 200" in names
    assert "Edifício Poucos Dados" not in names


@pytest.mark.usefixtures("demo")
async def test_financing_page_matches_core_finance(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/vila-mariana/financing")
    settings = get_settings()
    assert page["down_payment_pct"] == 20 and page["term_months"] == 360
    assert page["annual_rate_bps"] == settings.financing_illustrative_annual_rate_bps
    price = page["median_value_cents"]
    by_system = {s["system"]: s for s in page["simulations"]}
    for system in (AmortizationSystem.SAC, AmortizationSystem.PRICE):
        expected = simulate(
            property_price_cents=price,
            down_payment_cents=price * 20 // 100,
            term_months=360,
            annual_rate_bps=settings.financing_illustrative_annual_rate_bps,
            system=system,
        )
        got = by_system[system.value]
        assert got["first_payment_cents"] == expected.first_payment_cents
        assert got["min_income_cents"] == -(-expected.first_payment_cents * 100 // 30)


@pytest.mark.usefixtures("demo")
async def test_financing_page_below_the_gate_has_no_simulation(client: AsyncClient) -> None:
    page = await _get(client, "/neighborhoods/aclimacao/financing")
    assert page["median_value_cents"] is None and page["simulations"] == []


@pytest.mark.usefixtures("demo")
async def test_sitemaps_list_only_indexable_pages(client: AsyncClient) -> None:
    bairros = [e["path"] for e in (await _get(client, "/sitemaps/bairros"))["entries"]]
    assert bairros[0] == "/preco-m2/sao-paulo"
    assert "/preco-m2/sao-paulo/vila-mariana" in bairros
    assert "/preco-m2/sao-paulo/aclimacao" not in bairros
    predios = [e["path"] for e in (await _get(client, "/sitemaps/condominios"))["entries"]]
    assert "/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo" in predios
    assert not any("poucos-dados" in p for p in predios)
    ruas = [e["path"] for e in (await _get(client, "/sitemaps/ruas"))["entries"]]
    assert "/preco-m2/sao-paulo/vila-mariana/rua-das-acacias-ficticias" in ruas
    financing = [e["path"] for e in (await _get(client, "/sitemaps/financiamento"))["entries"]]
    assert financing == [
        "/financiamento/sao-paulo/moema",
        "/financiamento/sao-paulo/vila-mariana",
    ]


@pytest.mark.usefixtures("demo")
async def test_renamed_building_redirects(client: AsyncClient, session: AsyncSession) -> None:
    building = await session.scalar(
        select(MarketBuilding).where(MarketBuilding.slug == "condominio-jardim-exemplo")
    )
    assert building is not None
    session.add(
        MarketSlugRedirect(
            city_id=building.city_id,
            entity_type=SlugEntity.BUILDING,
            entity_id=building.id,
            parent_id=building.neighborhood_id,
            old_slug="nome-antigo",
        )
    )
    await session.flush()
    page = await _get(client, "/neighborhoods/vila-mariana/buildings/nome-antigo")
    assert page == {
        "kind": "redirect",
        "path": "/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo",
    }


@pytest.mark.usefixtures("demo")
async def test_unknown_pages_are_404(client: AsyncClient) -> None:
    for path in ("/neighborhoods/nao-existe", "/neighborhoods/vila-mariana/streets/nao-existe"):
        response = await client.get(f"{BASE}{path}")
        assert response.status_code == 404
    assert (await client.get("/v1/public/market/rio-de-janeiro")).status_code == 404


@pytest.mark.usefixtures("demo")
async def test_city_index(client: AsyncClient) -> None:
    page = await _get(client, "")
    rows = {r["place"]["slug"]: r for r in page["neighborhoods"]}
    assert rows["vila-mariana"]["indexable"] and rows["vila-mariana"]["stats"]["sales"] == 56
    assert rows["aclimacao"]["stats"] is None  # curated, listed, no numbers
    assert json.dumps(page).count("median_value_cents") >= 2


def _stats(**overrides: Any) -> MarketStats:
    values: dict[str, Any] = {
        "entity_type": StatsEntity.BUILDING,
        "window": "all",
        "window_start": None,
        "window_end": date(2026, 8, 31),
        "tx_count": 5,
        "median_sample": 5,
        "median_value_cents": 68_949_900,
        "median_price_m2_cents": 1_234_567,
        "p25_price_m2_cents": 1_000_000,
        "p75_price_m2_cents": 1_400_000,
        "median_built_area_m2": Decimal("67.40"),
        "p25_built_area_m2": Decimal("60"),
        "p75_built_area_m2": Decimal("80"),
        "financed_share": Decimal("0.6667"),
        "median_financed_share": Decimal("0.7049"),
        "top_financing_type_code": 1,
        "median_construction_year": 2001,
        "last_transaction_month": date(2026, 7, 1),
        "refreshed_at": datetime(2026, 11, 20, tzinfo=UTC),
    }
    return MarketStats(**(values | overrides))


def test_publish_rounds_and_gates() -> None:
    gates = Gates.from_settings(get_settings())
    public = gates.publish(_stats(), gates.building_all)
    assert public is not None
    assert public.median_value_cents == 68_900_000
    assert public.median_price_m2_cents == 1_235_000
    assert public.p25_price_m2_cents is None  # 5 sales: no ranges
    assert public.median_built_area_m2 == 65  # 67.4 m² -> nearest 5 m²
    assert (public.financed_pct, public.median_financed_pct) == (67, 70)
    assert public.last_sale_month is None and public.last_sale_year == 2026
    # Below the gate, and when flagged sales leave too few for a median: nothing.
    assert gates.publish(_stats(tx_count=4, median_sample=4), gates.building_all) is None
    assert gates.publish(_stats(tx_count=9, median_sample=4), gates.building_all) is None
    wide = gates.publish(_stats(tx_count=12, median_sample=12), gates.building_all)
    assert wide is not None and wide.p25_price_m2_cents == 1_000_000
    assert wide.median_built_area_m2 == 67 and wide.last_sale_month == "2026-07"
