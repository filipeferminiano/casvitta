"""Mortgage simulation: SAC and Price (French) amortization tables.

Every number produced here is a *simulation*, never a credit approval. The UI must label it
"Simulação · não é aprovação" and show the rate, the term, the down payment, and that insurance
(MIP/DFI) and bank fees are not included.

Money is integer cents. Rates are Decimals per period (0.01 == 1 % a month). Brazilian banks quote
an effective annual rate, so convert it with :func:`annual_to_monthly_rate`.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, localcontext
from enum import StrEnum

from app.core.money import round_cents, split_evenly

MAX_TERM_MONTHS = 420  # 35 years, the usual SFH ceiling


class AmortizationSystem(StrEnum):
    SAC = "sac"
    PRICE = "price"


class FinancingInputError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Installment:
    number: int
    payment_cents: int
    interest_cents: int
    amortization_cents: int
    balance_cents: int  # outstanding balance after this payment


@dataclass(frozen=True, slots=True)
class FinancingSimulation:
    system: AmortizationSystem
    property_price_cents: int
    down_payment_cents: int
    fgts_cents: int
    principal_cents: int
    annual_rate_bps: int
    monthly_rate: Decimal
    term_months: int
    installments: tuple[Installment, ...]
    first_payment_cents: int
    last_payment_cents: int
    total_paid_cents: int
    total_interest_cents: int
    first_payment_income_share: Decimal | None  # 0.28 == 28 % of household income
    is_simulation: bool = True
    includes_insurance_and_fees: bool = False


def bps_to_rate(bps: int) -> Decimal:
    return Decimal(bps) / Decimal(10_000)


def annual_to_monthly_rate(annual_rate: Decimal) -> Decimal:
    """Effective annual rate -> equivalent effective monthly rate: (1 + a)^(1/12) - 1."""
    if annual_rate < 0:
        raise FinancingInputError("rate must not be negative")
    with localcontext() as ctx:
        ctx.prec = 34
        monthly: Decimal = (Decimal(1) + annual_rate) ** (Decimal(1) / Decimal(12)) - Decimal(1)
    return monthly


def _validate(principal_cents: int, monthly_rate: Decimal, term_months: int) -> None:
    if principal_cents <= 0:
        raise FinancingInputError("principal must be positive")
    if monthly_rate < 0:
        raise FinancingInputError("rate must not be negative")
    if not 1 <= term_months <= MAX_TERM_MONTHS:
        raise FinancingInputError(f"term must be between 1 and {MAX_TERM_MONTHS} months")


def price_table(principal_cents: int, monthly_rate: Decimal, term_months: int) -> list[Installment]:
    """Price system: constant payment; interest falls and amortization grows over time."""
    _validate(principal_cents, monthly_rate, term_months)
    with localcontext() as ctx:
        ctx.prec = 34
        if monthly_rate == 0:
            payment = round_cents(Decimal(principal_cents) / term_months)
        else:
            factor = (Decimal(1) + monthly_rate) ** term_months
            payment = round_cents(Decimal(principal_cents) * monthly_rate * factor / (factor - 1))

    rows: list[Installment] = []
    balance = principal_cents
    for number in range(1, term_months + 1):
        interest = round_cents(Decimal(balance) * monthly_rate)
        if number == term_months:  # last payment absorbs rounding so the balance closes at zero
            amortization = balance
            row_payment = interest + amortization
        else:
            amortization = payment - interest
            row_payment = payment
        balance -= amortization
        rows.append(Installment(number, row_payment, interest, amortization, balance))
    return rows


def sac_table(principal_cents: int, monthly_rate: Decimal, term_months: int) -> list[Installment]:
    """SAC system: constant amortization; payments start higher and fall every month."""
    _validate(principal_cents, monthly_rate, term_months)
    rows: list[Installment] = []
    balance = principal_cents
    for number, amortization in enumerate(split_evenly(principal_cents, term_months), start=1):
        interest = round_cents(Decimal(balance) * monthly_rate)
        balance -= amortization
        rows.append(Installment(number, amortization + interest, interest, amortization, balance))
    return rows


def simulate(
    *,
    property_price_cents: int,
    down_payment_cents: int,
    term_months: int,
    annual_rate_bps: int,
    system: AmortizationSystem = AmortizationSystem.SAC,
    fgts_cents: int = 0,
    household_income_cents: int | None = None,
) -> FinancingSimulation:
    """Simulate a financing for a property. The caller supplies the illustrative rate."""
    if min(property_price_cents, down_payment_cents, fgts_cents) < 0:
        raise FinancingInputError("amounts must not be negative")
    principal = property_price_cents - down_payment_cents - fgts_cents
    if principal <= 0:
        raise FinancingInputError("down payment and FGTS cover the whole price; nothing to finance")

    monthly_rate = annual_to_monthly_rate(bps_to_rate(annual_rate_bps))
    table = (sac_table if system is AmortizationSystem.SAC else price_table)(
        principal, monthly_rate, term_months
    )
    total_paid = sum(row.payment_cents for row in table)
    income_share = (
        (Decimal(table[0].payment_cents) / Decimal(household_income_cents)).quantize(
            Decimal("0.0001")
        )
        if household_income_cents
        else None
    )
    return FinancingSimulation(
        system=system,
        property_price_cents=property_price_cents,
        down_payment_cents=down_payment_cents,
        fgts_cents=fgts_cents,
        principal_cents=principal,
        annual_rate_bps=annual_rate_bps,
        monthly_rate=monthly_rate,
        term_months=term_months,
        installments=tuple(table),
        first_payment_cents=table[0].payment_cents,
        last_payment_cents=table[-1].payment_cents,
        total_paid_cents=total_paid,
        total_interest_cents=total_paid - principal,
        first_payment_income_share=income_share,
    )
