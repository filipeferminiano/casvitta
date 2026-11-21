"""Backoffice overview (BO1) and global search. Read-only, across tenants, staff only.

Numbers come only from data that exists. Anything the product does not record yet (properties
on air, subscribers, revenue, accounts at risk) is left out of the response, so the screen hides
it instead of showing a zero.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.masking import mask_email, mask_phone
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import (
    AuditLog,
    BrokerProfile,
    CreciReviewStatus,
    User,
    Workspace,
)
from app.domains.backoffice.captures import release_expired
from app.domains.backoffice.schemas import (
    ActivityItem,
    CaptureKindRow,
    FunnelStep,
    OverviewOut,
    OverviewTiles,
    QueueItem,
    SearchHit,
    SearchOut,
)
from app.domains.interest.models import InterestKind, InterestSignup, InterestStatus
from app.domains.staff.audit import Actor, record
from app.domains.staff.models import StaffUser
from app.domains.staff.permissions import Permission
from app.domains.staff.service import actor_name

QUIET_ACTIONS = (
    "staff.signed_in",
    "staff.reauthenticated",
    "search.performed",
    "broker_profile.listed",
    "creci.listed",
)

# Display order (mockup BO1/BO3): auctions first, then owners, investors, agencies, developers.
KIND_ORDER = (
    InterestKind.AUCTION,
    InterestKind.OWNER_LISTING,
    InterestKind.OWNER_LISTING_START,
    InterestKind.INVESTOR_INSTITUTIONAL,
    InterestKind.AGENCY,
    InterestKind.AGENCY_DEMO,
    InterestKind.DEVELOPER,
    InterestKind.RENTAL_ADMIN,
)

# Kinds whose requests wait for a person (handled in BO3).
OWNER_REQUEST_KINDS = (InterestKind.OWNER_LISTING,)


async def _count(session: AsyncSession, query: Select[int]) -> int:
    return int(await session.scalar(query) or 0)


async def overview(session: AsyncSession, actor: Actor, settings: Settings) -> OverviewOut:
    await release_expired(session)  # unanswered referrals are back in the queue
    now = utcnow()
    week_ago = now - timedelta(days=7)
    sla_cutoff = now - timedelta(hours=settings.creci_review_sla_hours)
    with cross_tenant(session):
        brokers = (
            select(func.count()).select_from(BrokerProfile).where(BrokerProfile.is_demo.is_(False))
        )
        brokers_total = await _count(session, brokers)
        brokers_week = await _count(session, brokers.where(BrokerProfile.created_at >= week_ago))
        creci_sent = await _count(session, brokers.where(BrokerProfile.creci_number.is_not(None)))
        # Waiting for the team: first analysis or a corrected number sent again. A correction
        # request waits for the broker, so it is not in this queue.
        pending = brokers.where(BrokerProfile.creci_review_status == CreciReviewStatus.PENDING)
        creci_pending = await _count(session, pending)
        creci_over_sla = await _count(
            session,
            pending.where(
                func.coalesce(BrokerProfile.creci_submitted_at, BrokerProfile.created_at)
                < sla_cutoff
            ),
        )
        creci_verified = await _count(
            session, brokers.where(BrokerProfile.creci_verified_at.is_not(None))
        )

    captures = await _captures(session, week_ago)
    owner_open = await _count(
        session,
        select(func.count())
        .select_from(InterestSignup)
        .where(
            InterestSignup.kind.in_(OWNER_REQUEST_KINDS),
            InterestSignup.assigned_broker_id.is_(None),
            InterestSignup.status != InterestStatus.UNSUBSCRIBED,
            InterestSignup.is_demo.is_(False),
        ),
    )
    investors_waiting = await _count(
        session,
        select(func.count())
        .select_from(InterestSignup)
        .where(
            InterestSignup.kind == InterestKind.INVESTOR_INSTITUTIONAL,
            InterestSignup.status == InterestStatus.CONFIRMED,
            InterestSignup.handled_at.is_(None),
            InterestSignup.is_demo.is_(False),
        ),
    )
    by_kind = {row.kind: row for row in captures}
    auction = by_kind.get(InterestKind.AUCTION)

    return OverviewOut(
        tiles=OverviewTiles(
            brokers_total=brokers_total,
            brokers_this_week=brokers_week,
            creci_pending=creci_pending,
            creci_pending_over_sla=creci_over_sla,
            captures_7d=sum(r.last_7d for r in captures),
            captures_7d_auction=auction.last_7d if auction else 0,
        ),
        queue=[
            QueueItem(key="creci", count=creci_pending, over_sla=creci_over_sla),
            QueueItem(key="owner_requests", count=owner_open),
            QueueItem(key="institutional_investors", count=investors_waiting),
        ],
        captures=captures,
        funnel=[
            FunnelStep(key="signed_up", count=brokers_total),
            FunnelStep(key="creci_sent", count=creci_sent),
            FunnelStep(key="creci_verified", count=creci_verified),
        ],
        activity=await _activity(session) if actor.can(Permission.VIEW_AUDIT) else None,
        creci_sla_hours=settings.creci_review_sla_hours,
    )


async def _captures(session: AsyncSession, since: datetime) -> list[CaptureKindRow]:
    rows = (
        await session.execute(
            select(
                InterestSignup.kind,
                func.count(),
                func.count().filter(InterestSignup.status == InterestStatus.CONFIRMED),
            )
            .where(InterestSignup.created_at >= since, InterestSignup.is_demo.is_(False))
            .group_by(InterestSignup.kind)
        )
    ).all()
    counts = {kind: (total, confirmed) for kind, total, confirmed in rows}
    open_owner = dict(
        (
            await session.execute(
                select(InterestSignup.kind, func.count())
                .where(
                    InterestSignup.kind.in_(OWNER_REQUEST_KINDS),
                    InterestSignup.assigned_broker_id.is_(None),
                    InterestSignup.status != InterestStatus.UNSUBSCRIBED,
                )
                .group_by(InterestSignup.kind)
            )
        )
        .tuples()
        .all()
    )
    return [
        CaptureKindRow(
            kind=kind,
            last_7d=counts.get(kind, (0, 0))[0],
            confirmed_7d=counts.get(kind, (0, 0))[1],
            open=open_owner.get(kind, 0) if kind in OWNER_REQUEST_KINDS else None,
        )
        for kind in KIND_ORDER
    ]


async def _activity(session: AsyncSession, limit: int = 5) -> list[ActivityItem]:
    rows = (
        await session.execute(
            select(AuditLog, StaffUser.name)
            .outerjoin(StaffUser, StaffUser.id == AuditLog.actor_staff_id)
            # Reads and sign-ins are noise on the overview; the audit screen has them all.
            .where(AuditLog.action.not_in(QUIET_ACTIONS))
            .order_by(AuditLog.occurred_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        ActivityItem(
            occurred_at=row.occurred_at,
            actor_name=actor_name(row, name),
            action=row.action,
            details={k: v for k, v in (row.details or {}).items() if not k.endswith("_id")},
        )
        for row, name in rows
    ]


# ------------------------------------------------------------------ search

_DIGITS = re.compile(r"\D")
SEARCH_LIMIT = 6


async def search(session: AsyncSession, actor: Actor, query: str) -> SearchOut:
    """Accounts (name, email), people from captures (name, phone, email) and CRECI numbers.

    Contacts come back masked; the search term is audited (it may be a phone or an email).
    """
    q = " ".join(query.split())
    digits = _DIGITS.sub("", q)
    like = f"%{q.lower()}%"
    hits: list[SearchHit] = []

    with cross_tenant(session):
        account_rows = (
            await session.execute(
                select(Workspace, BrokerProfile, User.email)
                .join(BrokerProfile, BrokerProfile.workspace_id == Workspace.id)
                .join(User, User.id == BrokerProfile.user_id)
                .where(
                    or_(
                        func.lower(Workspace.name).like(like),
                        func.lower(BrokerProfile.display_name).like(like),
                        func.lower(User.email).like(like),
                    )
                )
                .order_by(Workspace.created_at.desc())
                .limit(SEARCH_LIMIT)
            )
        ).all()
        hits += [
            SearchHit(
                kind="account",
                id=workspace.id,
                title=profile.display_name,
                subtitle=mask_email(email) or "",
                is_demo=workspace.is_demo,
            )
            for workspace, profile, email in account_rows
        ]
        if len(digits) >= 3:
            creci_rows = (
                await session.scalars(
                    select(BrokerProfile)
                    .where(
                        func.regexp_replace(BrokerProfile.creci_number, r"\D", "", "g").like(
                            f"%{digits}%"
                        )
                    )
                    .limit(SEARCH_LIMIT)
                )
            ).all()
            hits += [
                SearchHit(
                    kind="creci",
                    id=p.id,
                    title=p.display_name,
                    subtitle=f"CRECI-{p.creci_state or ''} {p.creci_number}-"
                    f"{p.creci_kind.value if p.creci_kind else 'F'}",
                    is_demo=p.is_demo,
                )
                for p in creci_rows
            ]

    person_filters = [func.lower(InterestSignup.name).like(like)]
    person_filters.append(func.lower(func.coalesce(InterestSignup.email, "")).like(like))
    if len(digits) >= 4:
        person_filters.append(InterestSignup.phone_e164.like(f"%{digits}%"))
    people = (
        await session.scalars(
            select(InterestSignup)
            .where(or_(*person_filters))
            .order_by(InterestSignup.created_at.desc())
            .limit(SEARCH_LIMIT)
        )
    ).all()
    hits += [
        SearchHit(
            kind="person",
            id=s.id,
            title=s.name,
            subtitle=" · ".join(part for part in (s.kind.value, mask_phone(s.phone_e164)) if part),
        )
        for s in people
    ]
    record(session, actor, "search.performed", "backoffice", None, query=q, results=len(hits))
    await session.flush()
    return SearchOut(query=q, hits=hits)
