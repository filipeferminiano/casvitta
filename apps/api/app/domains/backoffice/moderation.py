"""Listing moderation (BO6): automatic checks, and the queue of exceptions.

Only what fails a check or was reported reaches a person; the rest publishes directly. The checks
are pure functions over a `ListingForReview` snapshot, so they are tested without a database.
There is no listings table yet: the queue reads through `ModerationSource`, whose only
implementation today returns nothing, and the module stays off ("liga depois") until listings
land (Milestones 1 and 2). Thresholds come from settings.
"""

from __future__ import annotations

import statistics
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal, Protocol

from pydantic import BaseModel

from app.core.settings import Settings

Outcome = Literal["ok", "review", "fail"]
CheckKey = Literal["creci", "authorization", "price", "photo_text", "duplicate"]


@dataclass(frozen=True, slots=True)
class Authorization:
    kind: Literal["sale", "rent"]
    expires_on: date


@dataclass(frozen=True, slots=True)
class ListingForReview:
    """What the checks need to know about one listing (built from the record when it exists)."""

    listing_id: uuid.UUID
    title: str
    broker_name: str
    broker_creci_verified: bool
    transaction: Literal["sale", "rent"]
    price_cents: int
    authorization: Authorization | None
    # Prices (same transaction and unit) of comparable listings or sales.
    comparable_prices_cents: list[int] = field(default_factory=list)
    # Share of each photo's area covered by text (0..1), from the image analysis.
    photo_text_ratios: list[float] = field(default_factory=list)
    duplicate_of: uuid.UUID | None = None
    reports: list[str] = field(default_factory=list)  # visitor reports ("já vendido", …)


class CheckResult(BaseModel):
    key: CheckKey
    outcome: Outcome
    # Values for the pt-BR line on screen (e.g. {"pct": 27, "count": 14, "median_cents": …}).
    detail: dict[str, str | int | float]


def check_creci(listing: ListingForReview) -> CheckResult:
    """CLAUDE.md rule 1: nobody publishes without a verified CRECI."""
    return CheckResult(
        key="creci", outcome="ok" if listing.broker_creci_verified else "fail", detail={}
    )


def check_authorization(listing: ListingForReview, today: date) -> CheckResult:
    """CLAUDE.md rule 2: an authorization of the right kind, valid today."""
    auth = listing.authorization
    if auth is None:
        return CheckResult(key="authorization", outcome="fail", detail={"reason": "missing"})
    if auth.kind != listing.transaction:
        return CheckResult(key="authorization", outcome="fail", detail={"reason": "wrong_kind"})
    if auth.expires_on < today:
        return CheckResult(
            key="authorization",
            outcome="fail",
            detail={"reason": "expired", "expires_on": auth.expires_on.isoformat()},
        )
    return CheckResult(
        key="authorization",
        outcome="ok",
        detail={"expires_on": auth.expires_on.isoformat()},
    )


def check_price(listing: ListingForReview, settings: Settings) -> CheckResult:
    """Far from the comparables' median: a typo or bait. Too few comparables: no judgement."""
    comps = listing.comparable_prices_cents
    if len(comps) < settings.moderation_min_comparables:
        return CheckResult(key="price", outcome="ok", detail={"count": len(comps), "few": 1})
    median = int(statistics.median(comps))
    pct = round((listing.price_cents - median) / median * 100) if median else 0
    outcome: Outcome = "review" if abs(pct) > settings.moderation_price_deviation_pct else "ok"
    return CheckResult(
        key="price",
        outcome=outcome,
        detail={"pct": pct, "count": len(comps), "median_cents": median},
    )


def check_photo_text(listing: ListingForReview, settings: Settings) -> CheckResult:
    """Phone numbers or ads written on photos bypass the platform."""
    worst = max(listing.photo_text_ratios, default=0.0)
    outcome: Outcome = "review" if worst > settings.moderation_max_photo_text_ratio else "ok"
    return CheckResult(key="photo_text", outcome=outcome, detail={"worst": round(worst, 2)})


def check_duplicate(listing: ListingForReview) -> CheckResult:
    if listing.duplicate_of is None:
        return CheckResult(key="duplicate", outcome="ok", detail={})
    return CheckResult(key="duplicate", outcome="review", detail={"of": str(listing.duplicate_of)})


def run_checks(listing: ListingForReview, settings: Settings, today: date) -> list[CheckResult]:
    return [
        check_creci(listing),
        check_authorization(listing, today),
        check_price(listing, settings),
        check_photo_text(listing, settings),
        check_duplicate(listing),
    ]


def needs_person(checks: list[CheckResult], listing: ListingForReview) -> bool:
    """Queue rule: anything not "ok", or any report. The rest publishes directly."""
    return bool(listing.reports) or any(c.outcome != "ok" for c in checks)


def expires_soon(auth: Authorization | None, today: date, days: int = 30) -> bool:
    """For the broker's reminder: the authorization ends within `days`."""
    return auth is not None and today <= auth.expires_on <= today + timedelta(days=days)


# ------------------------------------------------------------------ queue


class ModerationSource(Protocol):
    async def listings_to_check(self) -> list[ListingForReview]: ...


class NoListingsYet:
    """There is no listings table yet: nothing to moderate."""

    async def listings_to_check(self) -> list[ListingForReview]:
        return []


class QueueItem(BaseModel):
    listing_id: uuid.UUID
    title: str
    broker_name: str
    price_cents: int
    transaction: Literal["sale", "rent"]
    reports: list[str]
    checks: list[CheckResult]


class ModerationQueueOut(BaseModel):
    # False until listings exist and the "moderation" module is switched on.
    enabled: bool
    items: list[QueueItem]


async def queue(source: ModerationSource, settings: Settings, today: date) -> ModerationQueueOut:
    enabled = "moderation" in settings.backoffice_modules
    if not enabled:
        return ModerationQueueOut(enabled=False, items=[])
    items = []
    for listing in await source.listings_to_check():
        checks = run_checks(listing, settings, today)
        if needs_person(checks, listing):
            items.append(
                QueueItem(
                    listing_id=listing.listing_id,
                    title=listing.title,
                    broker_name=listing.broker_name,
                    price_cents=listing.price_cents,
                    transaction=listing.transaction,
                    reports=listing.reports,
                    checks=checks,
                )
            )
    return ModerationQueueOut(enabled=True, items=items)
