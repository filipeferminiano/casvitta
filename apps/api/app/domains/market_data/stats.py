"""Small exact statistics on integers (no floats for money)."""

from __future__ import annotations

from collections.abc import Sequence
from decimal import ROUND_HALF_UP, Decimal

OUTLIER_MIN_GROUP = 50  # p1/p99 are meaningless on small groups: flag nothing below this size


def percentile(sorted_values: Sequence[int], pct: int) -> int:
    """Linear interpolation between closest ranks (same as numpy's default), rounded half up."""
    if not sorted_values:
        raise ValueError("percentile of an empty sequence")
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = Decimal(pct) / 100 * (len(sorted_values) - 1)
    low = int(position)
    high = min(low + 1, len(sorted_values) - 1)
    fraction = position - low
    value = sorted_values[low] + (sorted_values[high] - sorted_values[low]) * fraction
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def median(values: Sequence[int]) -> int:
    return percentile(sorted(values), 50)


def outside_p1_p99(values: Sequence[int]) -> list[bool]:
    """Per value: below p1 or above p99 of the group. Groups under OUTLIER_MIN_GROUP: none."""
    if len(values) < OUTLIER_MIN_GROUP:
        return [False] * len(values)
    ordered = sorted(values)
    low, high = percentile(ordered, 1), percentile(ordered, 99)
    return [v < low or v > high for v in values]


def round_to(value: int, step: int) -> int:
    """Round an integer (cents) to the nearest multiple of ``step``, half up."""
    return int((Decimal(value) / step).quantize(Decimal(1), rounding=ROUND_HALF_UP)) * step
