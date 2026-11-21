"""ITBI (imposto de transmissão) estimate. Pure function; rates come from configuration.

São Paulo, as configured (a person reviews the rules against current law before the page is
indexed; see settings.itbi_sp_*):
- Tax base = the larger of the purchase price and the venal reference value (when given).
- General rate on the base.
- Under SFH, the financed part (up to the configured limit, when set) pays the reduced rate;
  the rest of the base pays the general rate.
Money in integer cents; rates in basis points. The result is an estimate, not the official guide.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.core.settings import Settings


class ItbiInputError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ItbiRules:
    rate_bps: int
    sfh_rate_bps: int
    sfh_limit_cents: int | None
    effective_from: str
    reviewed: bool

    @classmethod
    def sao_paulo(cls, settings: Settings) -> ItbiRules:
        return cls(
            rate_bps=settings.itbi_sp_rate_bps,
            sfh_rate_bps=settings.itbi_sp_sfh_rate_bps,
            sfh_limit_cents=settings.itbi_sp_sfh_limit_cents,
            effective_from=settings.itbi_sp_rules_effective_from,
            reviewed=settings.itbi_sp_rules_reviewed,
        )


@dataclass(frozen=True, slots=True)
class ItbiPart:
    kind: str  # "financed_sfh" | "general"
    base_cents: int
    rate_bps: int
    tax_cents: int


@dataclass(frozen=True, slots=True)
class ItbiResult:
    base_cents: int
    base_is_venal: bool
    parts: tuple[ItbiPart, ...]
    total_cents: int


def _tax(base_cents: int, rate_bps: int) -> int:
    return int((Decimal(base_cents) * rate_bps / 10_000).quantize(Decimal(1), ROUND_HALF_UP))


def compute_itbi(
    rules: ItbiRules,
    *,
    price_cents: int,
    venal_cents: int | None = None,
    financed_cents: int | None = None,
    sfh: bool = False,
) -> ItbiResult:
    if price_cents <= 0:
        raise ItbiInputError("price must be positive")
    if (venal_cents or 0) < 0 or (financed_cents or 0) < 0:
        raise ItbiInputError("amounts must not be negative")
    base = max(price_cents, venal_cents or 0)
    parts: list[ItbiPart] = []
    reduced = 0
    if sfh and financed_cents:
        reduced = min(financed_cents, base)
        if rules.sfh_limit_cents is not None:
            reduced = min(reduced, rules.sfh_limit_cents)
        parts.append(
            ItbiPart("financed_sfh", reduced, rules.sfh_rate_bps, _tax(reduced, rules.sfh_rate_bps))
        )
    rest = base - reduced
    if rest > 0:
        parts.append(ItbiPart("general", rest, rules.rate_bps, _tax(rest, rules.rate_bps)))
    return ItbiResult(
        base_cents=base,
        base_is_venal=(venal_cents or 0) > price_cents,
        parts=tuple(parts),
        total_cents=sum(p.tax_cents for p in parts),
    )
