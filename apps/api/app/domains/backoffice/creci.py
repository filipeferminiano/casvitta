"""CRECI verification queue (BO2). Manual for now (CLAUDE.md rule 1): staff check the number in the
regional council's public lookup, then approve, ask for a correction or refuse, with a reason that
goes to the broker by email. Only "verified" lets the broker publish.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.i18n import translate
from app.core.masking import mask_email
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import (
    BrokerProfile,
    CreciKind,
    CreciReviewStatus,
    Plan,
    User,
    Workspace,
)
from app.domains.staff.audit import Actor, record
from app.integrations.messaging.port import Email, EmailPort

QUEUE_LIMIT = 200


class CreciItem(BaseModel):
    id: uuid.UUID  # broker profile
    workspace_id: uuid.UUID
    display_name: str
    email: str  # masked
    city: str | None
    creci_name: str | None
    creci_number: str | None  # "000.000-F"
    creci_state: str | None
    creci_kind: CreciKind | None
    status: CreciReviewStatus
    # A corrected number sent again after a correction request ("Correção enviada").
    resubmitted: bool
    submitted_at: datetime | None
    waiting_hours: int
    over_sla: bool
    reviewed_at: datetime | None
    reason: str | None
    plan: Plan
    signed_up_at: datetime
    lookup_url: str | None
    is_demo: bool


class CreciQueueOut(BaseModel):
    counts: dict[CreciReviewStatus, int]
    items: list[CreciItem]
    sla_hours: int


class CreciChecklist(BaseModel):
    """The four checks of the review panel. All must be true to approve."""

    number_exists: bool  # found in the council's public lookup
    name_matches: bool  # name in the register matches the sign-up
    active: bool  # registration active, not suspended
    kind_matches: bool  # F (person) or J (company) as declared


class CreciApproveIn(BaseModel):
    checklist: CreciChecklist


class ReasonIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def _clean(cls, value: str) -> str:
        return " ".join(value.split())


Tab = Literal["pending", "correction_requested", "verified", "rejected"]


def display_creci(profile: BrokerProfile) -> str | None:
    if not profile.creci_number:
        return None
    return f"{profile.creci_number}-{profile.creci_kind.value if profile.creci_kind else 'F'}"


def _item(
    profile: BrokerProfile, email: str, workspace: Workspace, settings: Settings, now: datetime
) -> CreciItem:
    submitted = profile.creci_submitted_at or profile.created_at
    hours = max(0, int((now - submitted).total_seconds() // 3600))
    status = profile.creci_review_status or CreciReviewStatus.PENDING
    waiting = status == CreciReviewStatus.PENDING
    return CreciItem(
        id=profile.id,
        workspace_id=profile.workspace_id,
        display_name=profile.display_name,
        email=mask_email(email) or "",
        city=profile.regions[0] if profile.regions else None,
        creci_name=profile.creci_name,
        creci_number=display_creci(profile),
        creci_state=profile.creci_state,
        creci_kind=profile.creci_kind,
        status=status,
        resubmitted=waiting and profile.creci_review_reason is not None,
        submitted_at=profile.creci_submitted_at,
        waiting_hours=hours,
        over_sla=waiting and hours >= settings.creci_review_sla_hours,
        reviewed_at=profile.creci_reviewed_at,
        reason=profile.creci_review_reason,
        plan=workspace.plan,
        signed_up_at=profile.created_at,
        lookup_url=settings.creci_lookup_urls.get(profile.creci_state or ""),
        is_demo=profile.is_demo,
    )


async def queue(session: AsyncSession, actor: Actor, tab: Tab, settings: Settings) -> CreciQueueOut:
    status = CreciReviewStatus(tab)
    waiting = status in (CreciReviewStatus.PENDING, CreciReviewStatus.CORRECTION_REQUESTED)
    since = func.coalesce(BrokerProfile.creci_submitted_at, BrokerProfile.created_at)
    with cross_tenant(session):
        counts = dict(
            (
                await session.execute(
                    select(BrokerProfile.creci_review_status, func.count())
                    .where(BrokerProfile.creci_review_status.is_not(None))
                    .group_by(BrokerProfile.creci_review_status)
                )
            )
            .tuples()
            .all()
        )
        rows = (
            await session.execute(
                select(BrokerProfile, User.email, Workspace)
                .join(User, User.id == BrokerProfile.user_id)
                .join(Workspace, Workspace.id == BrokerProfile.workspace_id)
                .where(BrokerProfile.creci_review_status == status)
                # Waiting queues: oldest first (the promise is 1 business day). History: newest.
                .order_by(since.asc() if waiting else BrokerProfile.creci_reviewed_at.desc())
                .limit(QUEUE_LIMIT)
            )
        ).all()
    now = utcnow()
    items = [_item(p, email, w, settings, now) for p, email, w in rows]
    record(session, actor, "creci.listed", "broker_profiles", None, tab=tab, count=len(items))
    await session.flush()
    return CreciQueueOut(
        counts={s: int(counts.get(s, 0)) for s in CreciReviewStatus},
        items=items,
        sla_hours=settings.creci_review_sla_hours,
    )


async def _load(session: AsyncSession, profile_id: uuid.UUID) -> tuple[BrokerProfile, User]:
    row = (
        await session.execute(
            select(BrokerProfile, User)
            .join(User, User.id == BrokerProfile.user_id)
            .where(BrokerProfile.id == profile_id)
            .with_for_update(of=BrokerProfile)
        )
    ).first()
    if row is None or not row[0].creci_number:
        raise AppError("not_found", status_code=404)
    return row[0], row[1]


def _app_link(settings: Settings) -> str:
    return f"{settings.app_url}/configuracoes"


async def _notify(  # noqa: PLR0917
    email_port: EmailPort,
    user: User,
    profile: BrokerProfile,
    kind: str,
    settings: Settings,
    reason: str | None = None,
) -> None:
    await email_port.send(
        Email(
            to=user.email,
            subject=translate(f"email.creci_{kind}.subject"),
            text=translate(
                f"email.creci_{kind}.text",
                {
                    "name": profile.display_name.split(" ")[0],
                    "creci": f"{profile.creci_state or ''} {display_creci(profile)}".strip(),
                    "reason": reason or "",
                    "link": _app_link(settings),
                },
            ),
        )
    )


def _mark(
    profile: BrokerProfile, actor: Actor, status: CreciReviewStatus, reason: str | None
) -> None:
    now = utcnow()
    profile.creci_review_status = status
    profile.creci_review_reason = reason
    profile.creci_reviewed_at = now
    profile.creci_reviewed_by_id = actor.staff_id
    profile.creci_verified_at = now if status == CreciReviewStatus.VERIFIED else None


async def approve(
    session: AsyncSession,
    actor: Actor,
    profile_id: uuid.UUID,
    checklist: CreciChecklist,
    *,
    email_port: EmailPort,
    settings: Settings,
) -> CreciItem:
    if not all(checklist.model_dump().values()):
        raise AppError("checklist_incomplete", status_code=422)
    with cross_tenant(session):
        profile, user = await _load(session, profile_id)
        if profile.creci_review_status != CreciReviewStatus.PENDING:
            raise AppError("creci_not_pending", status_code=409)
        _mark(profile, actor, CreciReviewStatus.VERIFIED, None)
        record(
            session,
            actor,
            "creci.verified",
            "broker_profiles",
            profile.id,
            broker=profile.display_name,
            creci=f"CRECI-{profile.creci_state} {display_creci(profile)}",
            checklist=checklist.model_dump(),
        )
        await session.flush()
        workspace = await session.get(Workspace, profile.workspace_id)
    await _notify(email_port, user, profile, "verified", settings)
    if workspace is None:  # the foreign key makes this impossible
        raise AppError("not_found", status_code=404)
    return _item(profile, user.email, workspace, settings, utcnow())


async def decide(
    session: AsyncSession,
    actor: Actor,
    profile_id: uuid.UUID,
    outcome: Literal["correction_requested", "rejected"],
    reason: str,
    *,
    email_port: EmailPort,
    settings: Settings,
) -> CreciItem:
    """Ask for a correction (only while pending) or refuse (pending or waiting for a correction)."""
    status = CreciReviewStatus(outcome)
    allowed = (
        (CreciReviewStatus.PENDING,)
        if status == CreciReviewStatus.CORRECTION_REQUESTED
        else (CreciReviewStatus.PENDING, CreciReviewStatus.CORRECTION_REQUESTED)
    )
    with cross_tenant(session):
        profile, user = await _load(session, profile_id)
        if profile.creci_review_status not in allowed:
            raise AppError("creci_not_pending", status_code=409)
        _mark(profile, actor, status, reason)
        action = (
            "creci.correction_requested"
            if status == status.CORRECTION_REQUESTED
            else ("creci.rejected")
        )
        record(
            session,
            actor,
            action,
            "broker_profiles",
            profile.id,
            reason=reason,
            broker=profile.display_name,
            creci=f"CRECI-{profile.creci_state} {display_creci(profile)}",
        )
        await session.flush()
        workspace = await session.get(Workspace, profile.workspace_id)
    kind = "correction" if status == CreciReviewStatus.CORRECTION_REQUESTED else "rejected"
    await _notify(email_port, user, profile, kind, settings, reason)
    if workspace is None:  # the foreign key makes this impossible
        raise AppError("not_found", status_code=404)
    return _item(profile, user.email, workspace, settings, utcnow())
