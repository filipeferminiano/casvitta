"""Revenue (BO7). Billing (Stripe) is not wired, so there are no amounts yet: this returns the
revenue lines from the offer catalog in settings (names and prices), each with its status, and
never a number that did not happen. Media is never revenue: Meta and Google bill the broker
directly (CLAUDE.md rule 14). Commissions need Casvitta's own CRECI-J and the Rental OS.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.core.settings import Settings

Nature = Literal["recurring", "per_listing", "transaction", "transaction_recurring"]
LineStatus = Literal["waits_billing", "soon"]


class RevenueLine(BaseModel):
    key: str  # message key for the name on screen
    nature: Nature
    status: LineStatus
    # Catalog price; None = "sob consulta" or not defined yet (never shown as a number).
    price_cents: int | None
    per: Literal["month", "listing"] | None


class RevenueOut(BaseModel):
    # False until billing exists and the "revenue" module is on: no amounts, no charts.
    enabled: bool
    lines: list[RevenueLine]


def revenue(settings: Settings) -> RevenueOut:
    waits: LineStatus = "waits_billing"
    lines = [
        RevenueLine(
            key="saas_broker",
            nature="recurring",
            status=waits,
            price_cents=settings.offer_broker_price_cents,
            per="month",
        ),
        RevenueLine(
            key="saas_agency_essencial",
            nature="recurring",
            status=waits,
            price_cents=settings.offer_agency_essencial_price_cents,
            per="month",
        ),
        RevenueLine(
            key="saas_agency_equipe",
            nature="recurring",
            status=waits,
            price_cents=settings.offer_agency_equipe_price_cents,
            per="month",
        ),
        RevenueLine(
            key="saas_agency_larger", nature="recurring", status=waits, price_cents=None, per=None
        ),
        RevenueLine(
            key="owner_30d",
            nature="per_listing",
            status=waits,
            price_cents=settings.offer_owner_30d_price_cents,
            per="listing",
        ),
        RevenueLine(
            key="owner_90d",
            nature="per_listing",
            status=waits,
            price_cents=settings.offer_owner_90d_price_cents,
            per="listing",
        ),
        RevenueLine(
            key="highlight",
            nature="per_listing",
            status=waits,
            price_cents=settings.offer_highlight_price_cents,
            per="listing",
        ),
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
    # Billing is not wired yet: even with the module switched on there is nothing to read.
    return RevenueOut(enabled=False, lines=lines)
