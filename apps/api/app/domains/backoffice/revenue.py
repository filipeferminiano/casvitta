"""Revenue (BO7). Billing (Stripe) is not wired, so there are no amounts yet: this returns the
revenue lines from the catalog (app.core.catalog: names and prices), each with its status, and
never a number that did not happen. Media is never revenue: Meta and Google bill the broker
directly (CLAUDE.md rule 14). Commissions need Casvitta's own CRECI-J and the Rental OS.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.core.catalog import ADD_ONS, HIGHLIGHT_PACKAGES, OWNER_PACKAGES, SELLABLE, spec
from app.core.settings import Settings

Nature = Literal["recurring", "per_listing", "transaction", "transaction_recurring"]
LineStatus = Literal["waits_billing", "soon"]


class RevenueLine(BaseModel):
    key: str  # message key for the name on screen
    nature: Nature
    status: LineStatus
    # Catalog price; None = not defined (never shown as a number).
    price_cents: int | None
    per: Literal["month", "listing", "package"] | None
    price_from: bool = False  # "a partir de"


class RevenueOut(BaseModel):
    # False until billing exists and the "revenue" module is on: no amounts, no charts.
    enabled: bool
    lines: list[RevenueLine]


def revenue(settings: Settings) -> RevenueOut:
    waits: LineStatus = "waits_billing"
    lines = [
        RevenueLine(
            key=f"plan_{plan.value}",
            nature="recurring",
            status=waits,
            price_cents=spec(plan).monthly_cents,
            per="month",
            price_from=spec(plan).price_from,
        )
        for plan in SELLABLE
        if spec(plan).monthly_cents > 0
    ]
    lines += [
        RevenueLine(
            key=f"addon_{a.key}",
            nature="recurring",
            status=waits,
            price_cents=a.price_cents,
            per="package",
        )
        for a in ADD_ONS
    ]
    lines += [
        RevenueLine(
            key=f"owner_{days}d",
            nature="per_listing",
            status=waits,
            price_cents=cents,
            per="listing",
        )
        for days, cents in OWNER_PACKAGES.items()
    ]
    lines += [
        RevenueLine(
            key=f"highlight_{days}d",
            nature="per_listing",
            status=waits,
            price_cents=cents,
            per="listing",
        )
        for days, cents in HIGHLIGHT_PACKAGES.items()
    ]
    lines += [
        RevenueLine(
            key="commission_rent",
            nature="transaction_recurring",
            status="soon",
            price_cents=None,
            per=None,
        ),
        RevenueLine(
            key="commission_sale", nature="transaction", status="soon", price_cents=None, per=None
        ),
        RevenueLine(key="insurance", nature="recurring", status="soon", price_cents=None, per=None),
    ]
    # Billing is not wired yet (settings.billing_enabled): there is nothing to read.
    _ = settings.billing_enabled
    return RevenueOut(enabled=False, lines=lines)
