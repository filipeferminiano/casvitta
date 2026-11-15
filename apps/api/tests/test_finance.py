"""CLAUDE.md §4.5: SAC and Price tables, always a simulation."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.finance import (
    AmortizationSystem,
    FinancingInputError,
    annual_to_monthly_rate,
    price_table,
    sac_table,
    simulate,
)

ONE_PCT = Decimal("0.01")


def test_price_known_value() -> None:
    # R$ 1.000,00 at 1 % a month for 12 months -> PMT 88,85 (textbook value 88,8488)
    table = price_table(100_000, ONE_PCT, 12)
    assert table[0].payment_cents == 8_885
    assert table[0].interest_cents == 1_000
    assert table[0].amortization_cents == 7_885
    assert all(row.payment_cents == 8_885 for row in table[:-1])


@pytest.mark.parametrize("builder", [price_table, sac_table])
def test_tables_close_at_zero_and_amortize_principal(builder) -> None:  # type: ignore[no-untyped-def]
    principal = 55_200_000
    table = builder(principal, annual_to_monthly_rate(Decimal("0.115")), 360)
    assert len(table) == 360
    assert table[-1].balance_cents == 0
    assert sum(r.amortization_cents for r in table) == principal
    for row in table:
        assert row.payment_cents == row.interest_cents + row.amortization_cents


def test_sac_constant_amortization_decreasing_payment() -> None:
    table = sac_table(120_000, ONE_PCT, 12)
    assert {r.amortization_cents for r in table} == {10_000}
    assert table[0].payment_cents == 10_000 + 1_200
    assert table[-1].payment_cents == 10_000 + 100
    payments = [r.payment_cents for r in table]
    assert payments == sorted(payments, reverse=True)


def test_price_interest_falls_amortization_grows() -> None:
    table = price_table(100_000, ONE_PCT, 12)
    assert table[0].interest_cents > table[-1].interest_cents
    assert table[0].amortization_cents < table[-1].amortization_cents


def test_zero_rate() -> None:
    assert [r.payment_cents for r in price_table(1_000, Decimal(0), 3)] == [333, 333, 334]
    assert [r.payment_cents for r in sac_table(1_000, Decimal(0), 3)] == [334, 333, 333]


def test_annual_to_monthly_rate() -> None:
    monthly = annual_to_monthly_rate(Decimal("0.12"))
    assert monthly.quantize(Decimal("0.000001")) == Decimal("0.009489")
    assert ((1 + monthly) ** 12 - 1).quantize(Decimal("0.0000001")) == Decimal("0.1200000")


def test_simulate_demo_property() -> None:
    # Demo persona: R$ 690.000, 20 % down, R$ 30.000 FGTS, 30 years, 11,5 % a year
    sim = simulate(
        property_price_cents=69_000_000,
        down_payment_cents=13_800_000,
        fgts_cents=3_000_000,
        term_months=360,
        annual_rate_bps=1_150,
        system=AmortizationSystem.SAC,
        household_income_cents=2_500_000,
    )
    assert sim.principal_cents == 52_200_000
    assert sim.is_simulation is True
    assert sim.includes_insurance_and_fees is False
    assert sim.first_payment_cents > sim.last_payment_cents
    assert sim.total_interest_cents == sim.total_paid_cents - sim.principal_cents
    assert sim.first_payment_income_share is not None
    assert sim.first_payment_income_share == (
        Decimal(sim.first_payment_cents) / Decimal(2_500_000)
    ).quantize(Decimal("0.0001"))


def test_simulate_price_has_constant_payment() -> None:
    sim = simulate(
        property_price_cents=69_000_000,
        down_payment_cents=13_800_000,
        term_months=360,
        annual_rate_bps=1_150,
        system=AmortizationSystem.PRICE,
    )
    assert sim.first_payment_cents == sim.installments[1].payment_cents
    assert sim.first_payment_income_share is None


@pytest.mark.parametrize(
    "kwargs",
    [
        {"down_payment_cents": 69_000_000},  # nothing to finance
        {"down_payment_cents": -1},
        {"term_months": 0},
        {"term_months": 421},
        {"annual_rate_bps": -5},
    ],
)
def test_simulate_rejects_invalid_input(kwargs: dict[str, int]) -> None:
    params = {
        "property_price_cents": 69_000_000,
        "down_payment_cents": 13_800_000,
        "term_months": 360,
        "annual_rate_bps": 1_150,
    } | kwargs
    with pytest.raises(FinancingInputError):
        simulate(**params)  # type: ignore[arg-type]
