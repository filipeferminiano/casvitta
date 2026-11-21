"""Valuation method, ITBI rules, and their public endpoints (fabricated demo data)."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.itbi import ItbiInputError, ItbiRules, compute_itbi
from app.domains.market_data.valuation import Group, ValuationRules, estimate
from app.scripts.seed_market_demo import seed_demo

RULES = ItbiRules(
    rate_bps=300, sfh_rate_bps=50, sfh_limit_cents=None, effective_from="2026-01-01", reviewed=False
)
VECTORS = Path(__file__).parent / "fixtures" / "itbi_vectors.json"


# --- ITBI -----------------------------------------------------------------------------------


def test_itbi_cash_purchase() -> None:
    result = compute_itbi(RULES, price_cents=75_000_000)
    assert result.total_cents == 2_250_000  # R$ 750.000 × 3% = R$ 22.500
    assert [p.kind for p in result.parts] == ["general"]


def test_itbi_sfh_financed_part_pays_the_reduced_rate() -> None:
    result = compute_itbi(RULES, price_cents=75_000_000, financed_cents=60_000_000, sfh=True)
    # R$ 600.000 × 0,5% + R$ 150.000 × 3% = R$ 3.000 + R$ 4.500 (the mockup's example)
    assert [(p.kind, p.tax_cents) for p in result.parts] == [
        ("financed_sfh", 300_000),
        ("general", 450_000),
    ]
    assert result.total_cents == 750_000


def test_itbi_sfh_limit_caps_the_reduced_part() -> None:
    capped = ItbiRules(300, 50, 50_000_000, "2026-01-01", reviewed=True)
    result = compute_itbi(capped, price_cents=75_000_000, financed_cents=60_000_000, sfh=True)
    assert [p.base_cents for p in result.parts] == [50_000_000, 25_000_000]
    assert result.total_cents == 250_000 + 750_000


def test_itbi_venal_above_price_is_the_base() -> None:
    result = compute_itbi(RULES, price_cents=50_000_000, venal_cents=60_000_000)
    assert result.base_is_venal and result.base_cents == 60_000_000
    assert result.total_cents == 1_800_000


def test_itbi_not_sfh_ignores_financing_and_rejects_bad_input() -> None:
    plain = compute_itbi(RULES, price_cents=75_000_000, financed_cents=60_000_000, sfh=False)
    assert plain.total_cents == 2_250_000
    with pytest.raises(ItbiInputError):
        compute_itbi(RULES, price_cents=0)


def test_itbi_vectors_match() -> None:
    """The web calculator is tested against the same vectors (itbi.parity.test.ts)."""
    for case in json.loads(VECTORS.read_text())["cases"]:
        rules = ItbiRules(
            case["rate_bps"], case["sfh_rate_bps"], case["sfh_limit_cents"], "x", reviewed=False
        )
        result = compute_itbi(
            rules,
            price_cents=case["price_cents"],
            venal_cents=case["venal_cents"],
            financed_cents=case["financed_cents"],
            sfh=case["sfh"],
        )
        assert result.total_cents == case["total_cents"]
        assert result.base_cents == case["base_cents"]


# --- valuation method -----------------------------------------------------------------------


def group(level: str, sales: int, p50: int | None, p25: int = 0, p75: int = 0) -> Group:
    return Group(level, "50-80", sales, p50, p25 if p50 else None, p75 if p50 else None)  # type: ignore[arg-type]


def test_groups_below_ten_sales_never_enter_the_estimate() -> None:
    rules = ValuationRules()
    assert estimate([group("street_band", 9, None)], Decimal(70), rules) is None
    only = estimate(
        [
            group("street_band", 9, None),
            group("neighborhood_band", 40, 1_000_000, 900_000, 1_100_000),
        ],
        Decimal(70),
        rules,
    )
    assert only is not None and only.basis == "neighborhood_band"
    assert only.center_cents == 70_000_000  # R$ 10.000/m² × 70 m²


def test_specific_groups_weigh_more() -> None:
    rules = ValuationRules()
    result = estimate(
        [
            group("street_band", 40, 1_200_000, 1_100_000, 1_300_000),
            group("neighbors_band", 40, 800_000, 700_000, 900_000),
        ],
        Decimal(100),
        rules,
    )
    assert result is not None and result.price_m2_cents == 1_200_000


def test_range_widens_and_confidence_drops_with_few_comparables() -> None:
    rules = ValuationRules()
    many = estimate(
        [group("neighborhood_band", 60, 1_000_000, 950_000, 1_050_000)], Decimal(80), rules
    )
    few = estimate(
        [group("neighborhood_band", 12, 1_000_000, 950_000, 1_050_000)], Decimal(80), rules
    )
    assert many is not None and few is not None
    assert many.confidence == "alta"
    assert few.high_cents - few.low_cents > many.high_cents - many.low_cents
    assert few.confidence != "alta"
    wide = estimate(
        [group("neighbors_band", 11, 1_000_000, 600_000, 1_500_000)], Decimal(80), rules
    )
    assert wide is not None and wide.confidence == "baixa"


# --- endpoints ------------------------------------------------------------------------------

BASE = "/v1/public/market/sao-paulo"


@pytest.fixture
async def demo(session: AsyncSession) -> None:
    await seed_demo(session)


@pytest.mark.usefixtures("demo")
async def test_address_suggestions(client: AsyncClient) -> None:
    body = (await client.get(f"{BASE}/addresses", params={"q": "ipes"})).json()
    assert body["suggestions"][0]["street"] == "avenida-dos-ipes-ficticios"
    with_number = (await client.get(f"{BASE}/addresses", params={"q": "ipes, 45"})).json()
    assert with_number["suggestions"][0]["number"] == 45
    assert with_number["suggestions"][0]["label"] == "Avenida dos Ipes Ficticios, 45"
    assert len(with_number["suggestions"]) <= 3


@pytest.mark.usefixtures("demo")
async def test_valuation_endpoint(client: AsyncClient) -> None:
    payload = {
        "neighborhood": "vila-mariana",
        "street": "avenida-dos-ipes-ficticios",
        "kind": "apartment",
        "area_m2": "68",
        "bedrooms": 2,
    }
    body = (await client.post(f"{BASE}/valuation", json=payload)).json()
    assert body["status"] == "ok"
    assert body["low_cents"] <= body["center_cents"] <= body["high_cents"]
    assert body["center_cents"] % 100_000 == 0
    assert body["confidence"] in {"alta", "media", "baixa"}
    for g in body["groups"]:
        assert (g["median_price_m2_cents"] is None) == (g["sales"] < 10)
    # 4 own sales, but the neighbor Vila Mariana has enough: "em bairros vizinhos".
    nearby = {**payload, "neighborhood": "aclimacao", "street": None}
    nearby_body = (await client.post(f"{BASE}/valuation", json=nearby)).json()
    assert (nearby_body["status"], nearby_body["basis"]) == ("ok", "neighbors_band")
    # A place we have no data for: outside coverage.
    unknown = {**payload, "neighborhood": "bosque-da-saude", "street": None}
    assert (await client.post(f"{BASE}/valuation", json=unknown)).json()["status"] == (
        "outside_coverage"
    )


@pytest.mark.usefixtures("demo")
async def test_itbi_page(client: AsyncClient) -> None:
    body = (await client.get(f"{BASE}/itbi")).json()
    assert body["rules"]["reviewed"] is False and body["rules"]["rate_bps"] == 300
    rows = {r["place"]["slug"]: r for r in body["neighborhoods"]}
    assert rows["vila-mariana"]["median_itbi_cents"] is not None
    assert rows["aclimacao"]["median_itbi_cents"] is None  # 4 sales: count only
