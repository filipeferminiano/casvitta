"""Revenue (BO7). The revenue lines come from the catalog (names and prices); amounts come
only from what happened: the ledger (payments Stripe confirmed) and the live subscriptions.
Stripe test-mode payments are shown apart and never counted as revenue. Media is never revenue:
Meta and Google bill the broker directly (CLAUDE.md rule 14). Commissions need Casvitta's own
CRECI-J and the Rental OS.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import ADD_ONS, HIGHLIGHT_PACKAGES, OWNER_PACKAGES, SELLABLE, spec
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import TZ, today_local
from app.domains.accounts.models import Plan, Workspace
from app.domains.billing.models import (
    LedgerEntry,
    LedgerKind,
    LedgerStatus,
    Subscription,
    SubscriptionStatus,
)

Nature = Literal["recurring", "per_listing", "transaction", "transaction_recurring"]
LineStatus = Literal["waits_billing", "active", "soon"]


class RevenueLine(BaseModel):
    key: str  # message key for the name on screen
    nature: Nature
    status: LineStatus
    # Catalog price; None = not defined (never shown as a number).
    price_cents: int | None
    per: Literal["month", "listing", "package"] | None
    price_from: bool = False  # "a partir de"
    subscribers: int | None = None  # live (non-test) subscriptions with this plan / add-on units
    month_cents: int | None = None  # received this month (plans), from the ledger


class MonthTotal(BaseModel):
    month: str  # "2026-11"
    subscriptions_cents: int
    listings_cents: int


class FailedCharge(BaseModel):
    workspace_id: uuid.UUID
    workspace_name: str
    amount_cents: int  # monthly amount of the subscription (plan + add-ons, catalog prices)
    failed_at: datetime | None
    is_test: bool


class RevenueSummary(BaseModel):
    month_cents: int  # received this month (São Paulo calendar), non-test
    subscriptions_cents: int
    listings_cents: int  # Destaques and owner packages (none yet)
    mrr_cents: int  # live subscriptions at catalog prices
    active_subscriptions: int
    ending_subscriptions: int  # set to end at the period end
    ended_this_month: int
    churn_pct: float | None  # ended this month / (active + ended this month)
    failed_cents: int
    test_received_cents: int  # Stripe test mode: shown apart, never revenue


class RevenueOut(BaseModel):
    # False until billing is on: no amounts, no charts.
    enabled: bool
    lines: list[RevenueLine]
    summary: RevenueSummary | None = None
    months: list[MonthTotal] = []
    failed: list[FailedCharge] = []


def _month_start(day: date) -> datetime:
    return datetime(day.year, day.month, 1, tzinfo=TZ)


def _months_back(day: date, n: int) -> date:
    y, m = day.year, day.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return date(y, m, 1)


def monthly_cents(sub: Subscription) -> int:
    plan = spec(sub.plan).monthly_cents if sub.plan else 0
    extras = sum(a.price_cents * sub.add_ons.get(a.key, 0) for a in ADD_ONS if a.key in sub.add_ons)
    return plan + extras


LIVE = (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
LISTING_KINDS = (LedgerKind.HIGHLIGHT, LedgerKind.OWNER_LISTING)


async def revenue(session: AsyncSession, settings: Settings) -> RevenueOut:
    lines = catalog_lines(settings)
    if not settings.billing_enabled:
        return RevenueOut(enabled=False, lines=lines)
    today = today_local()
    start = _month_start(today)
    with cross_tenant(session):
        received = (
            await session.execute(
                select(
                    LedgerEntry.kind,
                    LedgerEntry.plan,
                    LedgerEntry.is_test,
                    LedgerEntry.amount_cents,
                    LedgerEntry.occurred_at,
                ).where(
                    LedgerEntry.status == LedgerStatus.RECEIVED,
                    LedgerEntry.occurred_at >= _month_start(_months_back(today, 5)),
                )
            )
        ).all()
        subs = (await session.scalars(select(Subscription))).all()
        names = (
            dict(
                (
                    await session.execute(
                        select(Workspace.id, Workspace.name).where(
                            Workspace.id.in_({s.workspace_id for s in subs})
                        )
                    )
                ).all()
            )
            if subs
            else {}
        )

    real = [r for r in received if not r.is_test]
    this_month = [r for r in real if r.occurred_at >= start]
    subs_cents = sum(r.amount_cents for r in this_month if r.kind not in LISTING_KINDS)
    listing_cents = sum(r.amount_cents for r in this_month if r.kind in LISTING_KINDS)
    months = []
    for back in range(5, -1, -1):
        first = _months_back(today, back)
        nxt = _months_back(today, back - 1) if back else None
        rows = [
            r
            for r in real
            if r.occurred_at >= _month_start(first)
            and (nxt is None or r.occurred_at < _month_start(nxt))
        ]
        months.append(
            MonthTotal(
                month=f"{first.year}-{first.month:02d}",
                subscriptions_cents=sum(
                    r.amount_cents for r in rows if r.kind not in LISTING_KINDS
                ),
                listings_cents=sum(r.amount_cents for r in rows if r.kind in LISTING_KINDS),
            )
        )
    live = [s for s in subs if s.status in LIVE and not s.is_test]
    ended = [s for s in subs if s.ended_at and s.ended_at >= start and not s.is_test]
    failing = [
        s
        for s in subs
        if s.status in LIVE
        and (s.status == SubscriptionStatus.PAST_DUE or s.last_payment_failed_at)
    ]
    base = len(live) + len(ended)
    by_plan: dict[Plan, int] = {}
    for s_ in live:
        if s_.plan:
            by_plan[s_.plan] = by_plan.get(s_.plan, 0) + 1
    units: dict[str, int] = {}
    for s_ in live:
        for key, qty in s_.add_ons.items():
            units[key] = units.get(key, 0) + qty
    plan_month: dict[str, int] = {}
    for r in this_month:
        if r.kind == LedgerKind.PLAN_SUBSCRIPTION and r.plan:
            key = f"plan_{r.plan.value}"
            plan_month[key] = plan_month.get(key, 0) + r.amount_cents
    for line in lines:
        if line.key.startswith("plan_"):
            line.status = "active"
            line.subscribers = by_plan.get(Plan(line.key.removeprefix("plan_")), 0)
            line.month_cents = plan_month.get(line.key, 0)
        elif line.key.startswith("addon_"):
            line.status = "active"
            line.subscribers = units.get(line.key.removeprefix("addon_"), 0)
    return RevenueOut(
        enabled=True,
        lines=lines,
        summary=RevenueSummary(
            month_cents=subs_cents + listing_cents,
            subscriptions_cents=subs_cents,
            listings_cents=listing_cents,
            mrr_cents=sum(monthly_cents(s) for s in live),
            active_subscriptions=len(live),
            ending_subscriptions=sum(1 for s in live if s.cancel_at_period_end),
            ended_this_month=len(ended),
            churn_pct=round(100 * len(ended) / base, 1) if base else None,
            failed_cents=sum(monthly_cents(s) for s in failing if not s.is_test),
            test_received_cents=sum(
                r.amount_cents for r in received if r.is_test and r.occurred_at >= start
            ),
        ),
        months=months,
        failed=[
            FailedCharge(
                workspace_id=s.workspace_id,
                workspace_name=names.get(s.workspace_id, "—"),
                amount_cents=monthly_cents(s),
                failed_at=s.last_payment_failed_at,
                is_test=s.is_test,
            )
            for s in failing
        ],
    )


def catalog_lines(settings: Settings) -> list[RevenueLine]:
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
    _ = settings
    return lines
