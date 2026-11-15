from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.core.money import MoneyError, apply_rate, format_brl, split_evenly, to_cents
from app.core.time import format_date, format_time


@pytest.mark.parametrize(
    ("raw", "cents"),
    [
        ("690000", 69_000_000),
        ("6563.40", 656_340),
        ("6.563,40", 656_340),
        ("R$ 820", 82_000),
        (Decimal("19.70"), 1_970),
        (197, 19_700),
    ],
)
def test_to_cents(raw: str | Decimal | int, cents: int) -> None:
    assert to_cents(raw) == cents


def test_to_cents_rejects_fractions_of_cent() -> None:
    with pytest.raises(MoneyError):
        to_cents("1.005")


def test_to_cents_rejects_garbage() -> None:
    with pytest.raises(MoneyError):
        to_cents("abc")


def test_format_brl() -> None:
    assert format_brl(69_000_000) == "R$ 690.000"
    assert format_brl(656_340) == "R$ 6.563,40"
    assert format_brl(9_600) == "R$ 96"
    assert format_brl(2_000, show_cents=True) == "R$ 20,00"
    assert format_brl(-1_050) == "-R$ 10,50"


def test_split_evenly_sums_exactly() -> None:
    parts = split_evenly(10_000, 3)
    assert parts == [3_334, 3_333, 3_333]
    assert sum(parts) == 10_000


def test_apply_rate_rounds_half_up() -> None:
    assert apply_rate(1_000, Decimal("0.0005")) == 1  # 0.5 cent -> 1
    assert apply_rate(69_000_000, Decimal("0.06")) == 4_140_000


def test_format_time_in_sao_paulo() -> None:
    assert format_time(datetime(2026, 11, 16, 17, 0, tzinfo=UTC)) == "14h"
    assert format_time(datetime(2026, 11, 16, 17, 3, tzinfo=UTC)) == "14h03"
    assert format_time(datetime(2026, 11, 16, 14, 30, tzinfo=UTC)) == "11h30"


def test_format_time_rejects_naive() -> None:
    with pytest.raises(ValueError, match="naive"):
        format_time(datetime(2026, 11, 16, 14, 0))  # noqa: DTZ001


def test_format_date() -> None:
    assert format_date(date(2026, 3, 7)) == "07/03/2026"
    # 01:00 UTC on the 8th is still the 7th in São Paulo
    assert format_date(datetime(2026, 3, 8, 1, 0, tzinfo=UTC)) == "07/03/2026"
