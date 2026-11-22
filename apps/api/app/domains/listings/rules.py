"""Publication gate (CLAUDE.md rules 1 and 2). Pure: callers load the rows, these decide.

A property reaches a public channel only when every check passes. The same checks run at read
time on public pages, so a listing whose authorization expired overnight disappears even before
the daily job unpublishes it.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from app.domains.properties.models import (
    AuthorizationReview,
    OwnerAuthorization,
    Property,
    PropertyStatus,
)


class Blocker(StrEnum):
    PROPERTY_NOT_ACTIVE = "property_not_active"
    NO_RESPONSIBLE_BROKER = "no_responsible_broker"
    CRECI_UNVERIFIED = "creci_unverified"
    AUTHORIZATION_MISSING = "authorization_missing"
    AUTHORIZATION_WRONG_KIND = "authorization_wrong_kind"
    AUTHORIZATION_EXPIRED = "authorization_expired"
    PUBLISHING_PAUSED = "publishing_paused"
    FEWER_PHOTOS = "fewer_photos"  # CRM mockup 04: minimum photos (config)
    AUTHORIZATION_REJECTED = "authorization_rejected"


MIN_PHOTOS = 5


@dataclass(frozen=True, slots=True)
class BrokerFacts:
    creci_verified_at: datetime | None


def valid_authorization(
    prop: Property, authorizations: Iterable[OwnerAuthorization], today: date
) -> OwnerAuthorization | None:
    """The authorization that covers the property today (right kind, not revoked, not expired)."""
    valid = [
        a
        for a in authorizations
        if a.property_id == prop.id
        and a.revoked_at is None
        and a.review_status != AuthorizationReview.REJECTED
        and a.kind == prop.transaction
        and a.expires_at >= today
    ]
    return max(valid, key=lambda a: a.expires_at, default=None)


def authorization_blocker(
    prop: Property, authorizations: Iterable[OwnerAuthorization], today: date
) -> Blocker | None:
    mine = [a for a in authorizations if a.property_id == prop.id and a.revoked_at is None]
    if valid_authorization(prop, mine, today) is not None:
        return None
    if not mine:
        return Blocker.AUTHORIZATION_MISSING
    if any(
        a.review_status == AuthorizationReview.REJECTED
        and a.kind == prop.transaction
        and a.expires_at >= today
        for a in mine
    ):
        return Blocker.AUTHORIZATION_REJECTED
    if not any(a.kind == prop.transaction for a in mine):
        return Blocker.AUTHORIZATION_WRONG_KIND
    return Blocker.AUTHORIZATION_EXPIRED


def publish_blockers(
    prop: Property,
    broker: BrokerFacts | None,
    authorizations: Iterable[OwnerAuthorization],
    today: date,
    *,
    workspace_paused: bool = False,
    photos: int | None = None,
    min_photos: int = MIN_PHOTOS,
) -> list[Blocker]:
    """`photos` None = not checked (callers that only re-check rules 1 and 2 at read time)."""
    blockers: list[Blocker] = []
    if prop.status != PropertyStatus.ACTIVE:
        blockers.append(Blocker.PROPERTY_NOT_ACTIVE)
    if broker is None:
        blockers.append(Blocker.NO_RESPONSIBLE_BROKER)
    elif broker.creci_verified_at is None:
        blockers.append(Blocker.CRECI_UNVERIFIED)
    auth = authorization_blocker(prop, list(authorizations), today)
    if auth is not None:
        blockers.append(auth)
    if photos is not None and photos < min_photos:
        blockers.append(Blocker.FEWER_PHOTOS)
    if workspace_paused:
        blockers.append(Blocker.PUBLISHING_PAUSED)
    return blockers


def publicly_verified(
    prop: Property, authorizations: Iterable[OwnerAuthorization], today: date
) -> bool:
    """Public pages need the valid authorization to be checked by staff too."""
    auth = valid_authorization(prop, authorizations, today)
    return auth is not None and auth.review_status == AuthorizationReview.VERIFIED
