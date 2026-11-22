"""Customer accounts (BO4) and the account 360 view (BO5).

Only what the product records today: workspace, plan chosen, team with CRECI status, last access,
the publishing pause, internal notes and a timeline from the audit log. Subscriptions, invoices,
properties, leads, visits and ad accounts are not in the database yet, so the response leaves
them out and the screen shows an honest empty state.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import (
    AccountNote,
    AuditLog,
    BrokerProfile,
    Membership,
    Plan,
    Role,
    User,
    Workspace,
    WorkspaceKind,
)
from app.domains.accounts.service import create_view_as_handoff
from app.domains.backoffice.creci import display_creci
from app.domains.billing.models import LedgerEntry, Subscription
from app.domains.staff.audit import Actor, record
from app.domains.staff.models import StaffUser
from app.domains.staff.service import actor_name

LIST_LIMIT = 300
TIMELINE_LIMIT = 30
NO_ACCESS_DAYS = 7

AccountFilter = Literal["all", "agencies", "creci_pending", "no_access", "paused"]
CreciState = Literal["missing", "pending", "correction_requested", "verified", "rejected"]


class AccountRow(BaseModel):
    id: uuid.UUID
    name: str
    kind: WorkspaceKind
    city: str | None
    members: int
    plan: Plan
    creci: CreciState  # the owner's
    last_access_at: datetime | None
    publishing_paused: bool
    created_at: datetime
    is_demo: bool


class AccountListOut(BaseModel):
    counts: dict[AccountFilter, int]
    items: list[AccountRow]


class TeamMember(BaseModel):
    name: str
    role: Role
    creci: CreciState
    creci_number: str | None
    last_access_at: datetime | None


class TimelineItem(BaseModel):
    occurred_at: datetime
    actor_name: str
    action: str
    details: dict[str, object]
    reason: str | None


class Note(BaseModel):
    id: uuid.UUID
    body: str
    author: str
    created_at: datetime


class PaymentRow(BaseModel):
    occurred_at: datetime
    amount_cents: int
    status: str
    is_test: bool


class AccountBilling(BaseModel):
    """Read from the subscription Stripe confirms (no card data: that stays at Stripe)."""

    status: str
    plan: Plan | None
    add_ons: dict[str, int]
    current_period_end: datetime | None
    cancel_at_period_end: bool
    payment_failed_at: datetime | None
    is_test: bool
    monthly_cents: int
    payments: list[PaymentRow]


class Account360(BaseModel):
    id: uuid.UUID
    name: str
    kind: WorkspaceKind
    city: str | None
    plan: Plan
    created_at: datetime
    last_access_at: datetime | None
    publishing_paused_at: datetime | None
    publishing_paused_reason: str | None
    team: list[TeamMember]
    timeline: list[TimelineItem]
    notes: list[Note]
    is_demo: bool
    billing: AccountBilling | None = None


class ReasonIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def _clean(cls, value: str) -> str:
        return " ".join(value.split())


class NoteIn(BaseModel):
    body: str = Field(min_length=2, max_length=2000)


class ViewAsOut(BaseModel):
    url: str


def _creci(profile: BrokerProfile | None) -> CreciState:
    if profile is None or profile.creci_review_status is None:
        return "missing"
    return profile.creci_review_status.value


def _last(*values: datetime | None) -> datetime | None:
    present = [v for v in values if v is not None]
    return max(present) if present else None


async def _members(
    session: AsyncSession, workspace_ids: list[uuid.UUID]
) -> list[tuple[Membership, User, BrokerProfile | None]]:
    if not workspace_ids:
        return []
    rows = (
        await session.execute(
            select(Membership, User, BrokerProfile)
            .join(User, User.id == Membership.user_id)
            .outerjoin(
                BrokerProfile,
                (BrokerProfile.user_id == User.id)
                & (BrokerProfile.workspace_id == Membership.workspace_id),
            )
            .where(Membership.workspace_id.in_(workspace_ids))
            .order_by(Membership.created_at)
        )
    ).all()
    return [(m, u, p) for m, u, p in rows]


async def list_accounts(
    session: AsyncSession, actor: Actor, view: AccountFilter = "all"
) -> AccountListOut:
    with cross_tenant(session):
        workspaces = (
            await session.scalars(
                select(Workspace).order_by(Workspace.created_at.desc()).limit(LIST_LIMIT)
            )
        ).all()
        members = await _members(session, [w.id for w in workspaces])
    by_ws: dict[uuid.UUID, list[tuple[Membership, User, BrokerProfile | None]]] = {}
    for m, u, p in members:
        by_ws.setdefault(m.workspace_id, []).append((m, u, p))

    now = utcnow()
    rows: list[AccountRow] = []
    for w in workspaces:
        team = by_ws.get(w.id, [])
        owner = next((p for m, _u, p in team if m.role == Role.OWNER), None)
        rows.append(
            AccountRow(
                id=w.id,
                name=w.name,
                kind=w.kind,
                city=(owner.regions[0] if owner and owner.regions else None),
                members=len(team),
                plan=w.plan,
                creci=_creci(owner),
                last_access_at=_last(
                    *(u.last_seen_at for _m, u, _p in team),
                    *(u.last_login_at for _m, u, _p in team),
                ),
                publishing_paused=w.publishing_paused_at is not None,
                created_at=w.created_at,
                is_demo=w.is_demo,
            )
        )

    def matches(row: AccountRow, f: AccountFilter) -> bool:
        if f == "agencies":
            return row.kind == WorkspaceKind.AGENCY
        if f == "creci_pending":
            return row.creci in ("pending", "correction_requested")
        if f == "no_access":
            return row.last_access_at is None or now - row.last_access_at > timedelta(
                days=NO_ACCESS_DAYS
            )
        if f == "paused":
            return row.publishing_paused
        return True

    filters: list[AccountFilter] = ["all", "agencies", "creci_pending", "no_access", "paused"]
    record(session, actor, "account.listed", "workspaces", None, view=view, count=len(rows))
    await session.flush()
    return AccountListOut(
        counts={f: sum(1 for r in rows if matches(r, f)) for f in filters},
        items=[r for r in rows if matches(r, view)],
    )


async def _workspace(session: AsyncSession, workspace_id: uuid.UUID) -> Workspace:
    with cross_tenant(session):
        workspace = await session.get(Workspace, workspace_id)
    if workspace is None:
        raise AppError("not_found", status_code=404)
    return workspace


async def account_360(session: AsyncSession, actor: Actor, workspace_id: uuid.UUID) -> Account360:
    workspace = await _workspace(session, workspace_id)
    with cross_tenant(session):
        team = await _members(session, [workspace.id])
    profile_ids = [str(p.id) for _m, _u, p in team if p is not None]
    entity_ids = [str(workspace.id), *profile_ids]
    timeline_rows = (
        await session.execute(
            select(AuditLog, StaffUser.name)
            .outerjoin(StaffUser, StaffUser.id == AuditLog.actor_staff_id)
            .where(
                AuditLog.entity_id.in_(entity_ids),
                AuditLog.action.not_in(["account.viewed", "broker_profile.listed"]),
            )
            .order_by(AuditLog.occurred_at.desc())
            .limit(TIMELINE_LIMIT)
        )
    ).all()
    notes = (
        await session.execute(
            select(AccountNote, StaffUser.name)
            .outerjoin(StaffUser, StaffUser.id == AccountNote.staff_user_id)
            .where(AccountNote.workspace_id == workspace.id)
            .order_by(AccountNote.created_at.desc())
        )
    ).all()
    owner = next((p for m, _u, p in team if m.role == Role.OWNER), None)
    billing = await _billing(session, workspace.id)
    record(session, actor, "account.viewed", "workspaces", workspace.id, name=workspace.name)
    await session.flush()
    return Account360(
        id=workspace.id,
        name=workspace.name,
        kind=workspace.kind,
        city=owner.regions[0] if owner and owner.regions else None,
        plan=workspace.plan,
        created_at=workspace.created_at,
        last_access_at=_last(
            *(u.last_seen_at for _m, u, _p in team), *(u.last_login_at for _m, u, _p in team)
        ),
        publishing_paused_at=workspace.publishing_paused_at,
        publishing_paused_reason=workspace.publishing_paused_reason,
        team=[
            TeamMember(
                name=p.display_name if p else u.name,
                role=m.role,
                creci=_creci(p),
                creci_number=(
                    f"CRECI-{p.creci_state} {display_creci(p)}" if p and p.creci_number else None
                ),
                last_access_at=_last(u.last_seen_at, u.last_login_at),
            )
            for m, u, p in team
        ],
        timeline=[
            TimelineItem(
                occurred_at=row.occurred_at,
                actor_name=actor_name(row, name),
                action=row.action,
                details={k: v for k, v in (row.details or {}).items() if not k.endswith("_id")},
                reason=row.reason,
            )
            for row, name in timeline_rows
        ],
        notes=[
            Note(id=n.id, body=n.body, author=name or "Equipe", created_at=n.created_at)
            for n, name in notes
        ],
        is_demo=workspace.is_demo,
        billing=billing,
    )


async def _billing(session: AsyncSession, workspace_id: uuid.UUID) -> AccountBilling | None:
    from app.domains.backoffice.revenue import monthly_cents  # noqa: PLC0415 - avoid a cycle

    with cross_tenant(session):
        sub = await session.scalar(
            select(Subscription)
            .where(Subscription.workspace_id == workspace_id)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        if sub is None:
            return None
        payments = (
            await session.scalars(
                select(LedgerEntry)
                .where(LedgerEntry.workspace_id == workspace_id)
                .order_by(LedgerEntry.occurred_at.desc())
                .limit(12)
            )
        ).all()
    return AccountBilling(
        status=sub.status.value,
        plan=sub.plan,
        add_ons=dict(sub.add_ons),
        current_period_end=sub.current_period_end,
        cancel_at_period_end=sub.cancel_at_period_end,
        payment_failed_at=sub.last_payment_failed_at,
        is_test=sub.is_test,
        monthly_cents=monthly_cents(sub),
        payments=[
            PaymentRow(
                occurred_at=p.occurred_at,
                amount_cents=p.amount_cents,
                status=p.status.value,
                is_test=p.is_test,
            )
            for p in payments
        ],
    )


async def set_publishing_paused(
    session: AsyncSession, actor: Actor, workspace_id: uuid.UUID, reason: str, *, paused: bool
) -> None:
    workspace = await _workspace(session, workspace_id)
    with cross_tenant(session):
        workspace.publishing_paused_at = utcnow() if paused else None
        workspace.publishing_paused_reason = reason if paused else None
        workspace.publishing_paused_by_id = actor.staff_id if paused else None
        record(
            session,
            actor,
            "account.publishing_paused" if paused else "account.publishing_resumed",
            "workspaces",
            workspace.id,
            reason=reason,
            name=workspace.name,
        )
        await session.flush()


async def add_note(session: AsyncSession, actor: Actor, workspace_id: uuid.UUID, body: str) -> Note:
    workspace = await _workspace(session, workspace_id)
    note = AccountNote(
        workspace_id=workspace.id,
        staff_user_id=actor.staff_id,
        body=body.strip(),
        created_at=utcnow(),
    )
    session.add(note)
    record(session, actor, "account.note_added", "workspaces", workspace.id, name=workspace.name)
    await session.flush()
    return Note(id=note.id, body=note.body, author=actor.name, created_at=note.created_at)


async def view_as(
    session: AsyncSession,
    actor: Actor,
    workspace_id: uuid.UUID,
    reason: str,
    *,
    settings: Settings,
) -> ViewAsOut:
    """Opens the customer's app read-only (BO5). Needs a reason; audited."""
    if actor.staff_id is None:
        raise AppError("forbidden", status_code=403)  # scripts never view as a customer
    workspace = await _workspace(session, workspace_id)
    with cross_tenant(session):
        team = await _members(session, [workspace.id])
    owner = next((u for m, u, _p in team if m.role == Role.OWNER), None) or (
        team[0][1] if team else None
    )
    if owner is None:
        raise AppError("not_found", status_code=404)
    code = await create_view_as_handoff(
        session,
        user_id=owner.id,
        workspace_id=workspace.id,
        staff_id=actor.staff_id,
        settings=settings,
    )
    record(
        session,
        actor,
        "account.viewed_as",
        "workspaces",
        workspace.id,
        reason=reason,
        name=workspace.name,
    )
    await session.flush()
    return ViewAsOut(url=f"{settings.app_url}/api/session/continue?code={code}&next=/inicio")
