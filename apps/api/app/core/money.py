"""Money helpers. Money is always integer cents in BRL; never floats.

Use Decimal only for intermediate math (rates, ratios) and round back to cents with
:func:`round_cents` (half-up, the usual convention for BRL amounts).
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CURRENCY = "BRL"
_CENT = Decimal(1)


class MoneyError(ValueError):
    pass


def round_cents(value: Decimal) -> int:
    return int(value.quantize(_CENT, rounding=ROUND_HALF_UP))


def to_cents(reais: str | Decimal | int) -> int:
    """Convert a reais amount to cents. Accepts '690000', '6563.40', '6.563,40', Decimal or int.

    Floats are rejected on purpose.
    """
    if isinstance(reais, float):  # pragma: no cover - guarded by typing too
        raise MoneyError("floats are not accepted for money")
    if isinstance(reais, int):
        return reais * 100
    if isinstance(reais, str):
        text = reais.strip().replace("R$", "").replace(" ", "").replace(" ", "")
        if "," in text:  # pt-BR format: dots are thousands separators, comma is decimal
            text = text.replace(".", "").replace(",", ".")
        try:
            reais = Decimal(text)
        except InvalidOperation as exc:
            raise MoneyError(f"invalid amount: {reais!r}") from exc
    cents = reais * 100
    if cents != cents.to_integral_value():
        raise MoneyError(f"amount has fractions of a cent: {reais}")
    return int(cents)


def apply_rate(amount_cents: int, rate: Decimal) -> int:
    """amount × rate, rounded to cents (e.g. a commission or a monthly interest)."""
    return round_cents(Decimal(amount_cents) * rate)


def split_evenly(amount_cents: int, parts: int) -> list[int]:
    """Split cents into ``parts`` integers that sum exactly to the amount (remainder goes first)."""
    if parts <= 0:
        raise MoneyError("parts must be positive")
    base, remainder = divmod(amount_cents, parts)
    return [base + 1 if i < remainder else base for i in range(parts)]


def format_brl(amount_cents: int, *, show_cents: bool | None = None) -> str:
    """Format like the UI: 'R$ 690.000' for whole amounts, 'R$ 6.563,40' otherwise."""
    negative = amount_cents < 0
    reais, cents = divmod(abs(amount_cents), 100)
    with_cents = cents != 0 if show_cents is None else show_cents
    integer = f"{reais:,}".replace(",", ".")
    text = f"R$ {integer},{cents:02d}" if with_cents else f"R$ {integer}"
    return f"-{text}" if negative else text
