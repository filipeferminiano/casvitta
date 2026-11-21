"""Captures (BO3): what arrives from the capture pages, by kind, and owner requests to refer.

Lists carry masked contacts. Seeing a full phone or email is a separate request that needs the
"contacts.reveal" permission, a recent proof of identity and a reason, and is audited (LGPD,
CLAUDE.md rule 8). Exports include only people who confirmed the WhatsApp opt-in and consented to
be contacted. Owner requests are pointed to a CRECI-verified broker (rule 13), who has 24 hours to
accept; otherwise the request goes back to the queue.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import String, cast, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.i18n import translate
from app.core.masking import mask_email, mask_phone
from app.core.security import hash_token, new_token
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import format_date, format_time, utcnow
from app.domains.accounts.models import BrokerProfile, CreciReviewStatus, User
from app.domains.alerts import service as alerts_service
from app.domains.alerts.models import AlertIntent, AlertScope
from app.domains.backoffice.creci import display_creci
from app.domains.interest.models import (
    AssignmentOutcome,
    ConsentPurpose,
    InterestAssignment,
    InterestKind,
    InterestSignup,
    InterestStatus,
)
from app.domains.staff.audit import Actor, record
from app.integrations.messaging.port import Email, EmailPort

OWNER_KINDS = (InterestKind.OWNER_LISTING,)
LIST_LIMIT = 300

CaptureState = Literal["no_broker", "referred", "accepted", "open", "handled"]
StateFilter = Literal["no_broker", "referred", "accepted", "open", "handled", "all"]
OptInFilter = Literal["confirmed", "pending", "all"]


class CaptureItem(BaseModel):
    id: uuid.UUID
    kind: InterestKind
    name: str
    phone: str  # masked
    email: str | None  # masked
    region: str | None
    criteria: dict[str, Any]
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    source_page: str | None
    opt_in: InterestStatus
    contact_consent: bool
    state: CaptureState
    broker_name: str | None  # referred or accepted broker
    assignment_expires_at: datetime | None
    created_at: datetime
    is_demo: bool


class CaptureListOut(BaseModel):
    counts: dict[InterestKind, int]
    items: list[CaptureItem]


class BrokerCandidate(BaseModel):
    id: uuid.UUID
    name: str
    creci: str
    regions: list[str]
    open_requests: int  # referred and not answered yet
    region_match: bool


class RevealIn(BaseModel):
    field: Literal["phone", "email"]
    reason: str = Field(min_length=5, max_length=300)

    @field_validator("reason")
    @classmethod
    def _clean(cls, value: str) -> str:
        return " ".join(value.split())


class RevealOut(BaseModel):
    field: Literal["phone", "email"]
    value: str | None


class AssignIn(BaseModel):
    broker_profile_id: uuid.UUID


class AcceptIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class AlertGroup(BaseModel):
    scope: AlertScope
    scope_name: str
    scope_path: str
    intent: AlertIntent
    active: int
    last_at: datetime


# ------------------------------------------------------------------ shape


def region_of(kind: InterestKind, criteria: dict[str, Any]) -> str | None:
    """Where the request is, as captured by its form (there is no CEP-to-neighbourhood map)."""
    if kind == InterestKind.OWNER_LISTING and criteria.get("cep"):
        cep = str(criteria["cep"])
        return f"CEP {cep[:5]}-{cep[5:]}"
    if criteria.get("cities"):
        return ", ".join(str(c) for c in criteria["cities"])
    if criteria.get("regions"):
        return str(criteria["regions"])
    city = criteria.get("city")
    return str(city) if city else None


def _state(signup: InterestSignup) -> CaptureState:
    if signup.kind in OWNER_KINDS:
        if signup.assignment_accepted_at is not None:
            return "accepted"
        return "referred" if signup.assigned_broker_id else "no_broker"
    return "handled" if signup.handled_at else "open"


def _consented(signup: InterestSignup) -> bool:
    return any(
        c.purpose == ConsentPurpose.CONTACT_ABOUT_PROPERTIES and c.granted for c in signup.consents
    )


def _item(signup: InterestSignup, brokers: dict[uuid.UUID, str]) -> CaptureItem:
    return CaptureItem(
        id=signup.id,
        kind=signup.kind,
        name=signup.name,
        phone=mask_phone(signup.phone_e164) or "",
        email=mask_email(signup.email),
        region=region_of(signup.kind, signup.criteria or {}),
        criteria=signup.criteria or {},
        utm_source=signup.utm_source,
        utm_medium=signup.utm_medium,
        utm_campaign=signup.utm_campaign,
        source_page=signup.source_page,
        opt_in=signup.status,
        contact_consent=_consented(signup),
        state=_state(signup),
        broker_name=brokers.get(signup.assigned_broker_id) if signup.assigned_broker_id else None,
        assignment_expires_at=signup.assignment_expires_at,
        created_at=signup.created_at,
        is_demo=signup.is_demo,
    )


# ------------------------------------------------------------------ expiry


async def release_expired(session: AsyncSession, now: datetime | None = None) -> int:
    """Referrals nobody accepted in time go back to the queue (audited as "system")."""
    now = now or utcnow()
    expired = (
        await session.scalars(
            select(InterestAssignment)
            .where(
                InterestAssignment.outcome == AssignmentOutcome.OPEN,
                InterestAssignment.expires_at <= now,
            )
            .with_for_update(skip_locked=True)
        )
    ).all()
    for assignment in expired:
        assignment.outcome = AssignmentOutcome.EXPIRED
        assignment.closed_at = now
        signup = await session.get(InterestSignup, assignment.signup_id)
        if signup is not None and signup.assigned_broker_id == assignment.broker_profile_id:
            signup.assigned_broker_id = None
            signup.assigned_at = None
            signup.assignment_expires_at = None
        record(
            session,
            Actor.system(),
            "interest.assignment_expired",
            "interest_signups",
            assignment.signup_id,
            broker_profile_id=str(assignment.broker_profile_id),
        )
    if expired:
        await session.flush()
    return len(expired)


# ------------------------------------------------------------------ list and detail


async def _broker_names(session: AsyncSession, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    with cross_tenant(session):
        rows = await session.execute(
            select(BrokerProfile.id, BrokerProfile.display_name).where(BrokerProfile.id.in_(ids))
        )
        return dict(rows.tuples().all())


async def list_captures(
    session: AsyncSession,
    actor: Actor,
    kind: InterestKind,
    *,
    state: StateFilter = "all",
    opt_in: OptInFilter = "all",
    region: str | None = None,
    origin: str | None = None,
) -> CaptureListOut:
    await release_expired(session)
    counts = dict(
        (
            await session.execute(
                select(InterestSignup.kind, func.count()).group_by(InterestSignup.kind)
            )
        )
        .tuples()
        .all()
    )
    query = select(InterestSignup).where(InterestSignup.kind == kind)
    if opt_in == "confirmed":
        query = query.where(InterestSignup.status == InterestStatus.CONFIRMED)
    elif opt_in == "pending":
        query = query.where(InterestSignup.status == InterestStatus.PENDING_OPT_IN)
    if region:
        like = f"%{region.lower()}%"
        query = query.where(func.lower(cast(InterestSignup.criteria, String)).like(like))
    if origin == "direct":
        query = query.where(InterestSignup.utm_source.is_(None))
    elif origin:
        query = query.where(func.lower(InterestSignup.utm_source) == origin.lower())
    if state == "no_broker":
        query = query.where(InterestSignup.assigned_broker_id.is_(None))
    elif state == "referred":
        query = query.where(
            InterestSignup.assigned_broker_id.is_not(None),
            InterestSignup.assignment_accepted_at.is_(None),
        )
    elif state == "accepted":
        query = query.where(InterestSignup.assignment_accepted_at.is_not(None))
    elif state == "open":
        query = query.where(InterestSignup.handled_at.is_(None))
    elif state == "handled":
        query = query.where(InterestSignup.handled_at.is_not(None))
    rows = (
        await session.scalars(query.order_by(InterestSignup.created_at.desc()).limit(LIST_LIMIT))
    ).all()
    brokers = await _broker_names(
        session, {r.assigned_broker_id for r in rows if r.assigned_broker_id}
    )
    record(
        session,
        actor,
        "interest.listed",
        "interest_signups",
        None,
        kind=kind.value,
        count=len(rows),
    )
    await session.flush()
    return CaptureListOut(
        counts={k: int(counts.get(k, 0)) for k in InterestKind},
        items=[_item(r, brokers) for r in rows],
    )


async def _signup(session: AsyncSession, signup_id: uuid.UUID) -> InterestSignup:
    signup = await session.get(InterestSignup, signup_id)
    if signup is None:
        raise AppError("not_found", status_code=404)
    return signup


async def get_capture(session: AsyncSession, actor: Actor, signup_id: uuid.UUID) -> CaptureItem:
    """Opening a request is a read of personal data by staff: audited."""
    await release_expired(session)
    signup = await _signup(session, signup_id)
    brokers = await _broker_names(
        session, {signup.assigned_broker_id} if signup.assigned_broker_id else set()
    )
    record(session, actor, "interest.viewed", "interest_signups", signup.id, kind=signup.kind.value)
    await session.flush()
    return _item(signup, brokers)


async def reveal(
    session: AsyncSession, actor: Actor, signup_id: uuid.UUID, payload: RevealIn
) -> RevealOut:
    signup = await _signup(session, signup_id)
    value = signup.phone_e164 if payload.field == "phone" else signup.email
    record(
        session,
        actor,
        "contact.revealed",
        "interest_signups",
        signup.id,
        reason=payload.reason,
        field=payload.field,
        person=_short_name(signup.name),
    )
    await session.flush()
    return RevealOut(field=payload.field, value=value)


def _short_name(name: str) -> str:
    """ "Paulo Mendes" -> "Paulo M." for audit details (the entity id points to the record)."""
    parts = name.split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else name


async def mark_handled(
    session: AsyncSession, actor: Actor, signup_id: uuid.UUID, handled: bool
) -> CaptureItem:
    signup = await _signup(session, signup_id)
    if signup.kind in OWNER_KINDS:
        raise AppError("owner_requests_are_referred", status_code=409)
    signup.handled_at = utcnow() if handled else None
    signup.handled_by_id = actor.staff_id if handled else None
    record(
        session,
        actor,
        "interest.handled" if handled else "interest.reopened",
        "interest_signups",
        signup.id,
        person=_short_name(signup.name),
        kind=signup.kind.value,
    )
    await session.flush()
    return _item(signup, {})


# ------------------------------------------------------------------ owner requests


def _words(text: str | None) -> set[str]:
    return {w for w in (text or "").lower().replace(",", " ").split() if len(w) > 2}


async def candidates(session: AsyncSession, signup_id: uuid.UUID) -> list[BrokerCandidate]:
    """Verified brokers, region overlap first, then the lightest current load."""
    signup = await _signup(session, signup_id)
    request_words = _words(region_of(signup.kind, signup.criteria or {}))
    load = dict(
        (
            await session.execute(
                select(InterestAssignment.broker_profile_id, func.count())
                .where(InterestAssignment.outcome == AssignmentOutcome.OPEN)
                .group_by(InterestAssignment.broker_profile_id)
            )
        )
        .tuples()
        .all()
    )
    with cross_tenant(session):
        brokers = (
            await session.scalars(
                select(BrokerProfile).where(
                    BrokerProfile.creci_review_status == CreciReviewStatus.VERIFIED,
                    BrokerProfile.creci_verified_at.is_not(None),
                    BrokerProfile.is_demo.is_(signup.is_demo),
                )
            )
        ).all()
    result = [
        BrokerCandidate(
            id=b.id,
            name=b.display_name,
            creci=f"CRECI-{b.creci_state} {display_creci(b)}",
            regions=list(b.regions or []),
            open_requests=int(load.get(b.id, 0)),
            region_match=bool(request_words & _words(" ".join(b.regions or []))),
        )
        for b in brokers
    ]
    result.sort(key=lambda c: (not c.region_match, c.open_requests, c.name))
    return result


async def assign(
    session: AsyncSession,
    actor: Actor,
    signup_id: uuid.UUID,
    broker_profile_id: uuid.UUID,
    *,
    email_port: EmailPort,
    settings: Settings,
) -> CaptureItem:
    await release_expired(session)
    signup = await session.get(InterestSignup, signup_id, with_for_update=True)
    if signup is None:
        raise AppError("not_found", status_code=404)
    if signup.kind not in OWNER_KINDS:
        raise AppError("not_an_owner_request", status_code=409)
    if signup.assignment_accepted_at is not None:
        raise AppError("already_accepted", status_code=409)
    if not _consented(signup) or signup.status == InterestStatus.UNSUBSCRIBED:
        # The owner never agreed to be contacted (or left): nobody gets their request.
        raise AppError("no_contact_consent", status_code=409)
    with cross_tenant(session):
        broker = await session.get(BrokerProfile, broker_profile_id)
        user = await session.get(User, broker.user_id) if broker else None
    if (
        broker is None
        or user is None
        or broker.creci_review_status != CreciReviewStatus.VERIFIED
        or broker.creci_verified_at is None
    ):
        # CLAUDE.md rule 13: only CRECI-registered (verified) brokers take owner requests.
        raise AppError("broker_not_verified", status_code=409)

    now = utcnow()
    # Someone else had it: their referral is withdrawn.
    await session.execute(
        update(InterestAssignment)
        .where(
            InterestAssignment.signup_id == signup.id,
            InterestAssignment.outcome == AssignmentOutcome.OPEN,
        )
        .values(outcome=AssignmentOutcome.WITHDRAWN, closed_at=now)
    )
    token = new_token()
    expires = now + timedelta(hours=settings.capture_assignment_timeout_hours)
    session.add(
        InterestAssignment(
            signup_id=signup.id,
            broker_profile_id=broker.id,
            assigned_by_id=actor.staff_id,
            accept_token_hash=hash_token(token),
            outcome=AssignmentOutcome.OPEN,
            assigned_at=now,
            expires_at=expires,
        )
    )
    signup.assigned_broker_id = broker.id
    signup.assigned_at = now
    signup.assignment_expires_at = expires
    record(
        session,
        actor,
        "interest.assigned",
        "interest_signups",
        signup.id,
        person=_short_name(signup.name),
        broker=broker.display_name,
        broker_profile_id=str(broker.id),
    )
    await session.flush()
    criteria = signup.criteria or {}
    # The broker sees what and where before accepting; the owner's contact comes after.
    await email_port.send(
        Email(
            to=user.email,
            subject=translate("email.capture_offer.subject"),
            text=translate(
                "email.capture_offer.text",
                {
                    "name": broker.display_name.split(" ")[0],
                    "what": _summary(signup.kind, criteria),
                    "region": region_of(signup.kind, criteria) or "",
                    "hours": settings.capture_assignment_timeout_hours,
                    "link": f"{settings.site_url}/corretor/aceitar-pedido#t={token}",
                },
            ),
        )
    )
    return _item(signup, {broker.id: broker.display_name})


_KIND_PT = {
    "apartment": "Apartamento",
    "house": "Casa",
    "studio": "Studio",
    "commercial": "Comercial",
    "land": "Terreno",
}


def _summary(kind: InterestKind, criteria: dict[str, Any]) -> str:
    """Plain pt-BR line for emails: "Vender · Apartamento · 2 quartos · 68 m²"."""
    parts = []
    if criteria.get("transaction"):
        parts.append("Vender" if criteria["transaction"] == "sale" else "Alugar")
    if criteria.get("property_kind"):
        parts.append(_KIND_PT.get(str(criteria["property_kind"]), str(criteria["property_kind"])))
    if criteria.get("bedrooms") is not None:
        parts.append(f"{criteria['bedrooms']} quartos")
    if criteria.get("area_m2"):
        parts.append(f"{criteria['area_m2']} m²")
    return " · ".join(parts) or kind.value


async def accept(
    session: AsyncSession, token: str, *, email_port: EmailPort
) -> Literal["accepted", "expired"]:
    """The broker's "Aceitar pedido" link. Gives them the owner's contact by email."""
    await release_expired(session)
    assignment = await session.scalar(
        select(InterestAssignment)
        .where(InterestAssignment.accept_token_hash == hash_token(token))
        .with_for_update()
    )
    if assignment is None:
        raise AppError("link_invalid", status_code=400)
    if assignment.outcome != AssignmentOutcome.OPEN:
        return "accepted" if assignment.outcome == AssignmentOutcome.ACCEPTED else "expired"
    now = utcnow()
    assignment.outcome = AssignmentOutcome.ACCEPTED
    assignment.closed_at = now
    signup = await _signup(session, assignment.signup_id)
    signup.assignment_accepted_at = now
    with cross_tenant(session):
        broker = await session.get(BrokerProfile, assignment.broker_profile_id)
        user = await session.get(User, broker.user_id) if broker else None
    record(
        session,
        Actor.system(),
        "interest.accepted",
        "interest_signups",
        signup.id,
        person=_short_name(signup.name),
        broker=broker.display_name if broker else "",
    )
    await session.flush()
    if broker is not None and user is not None:
        criteria = signup.criteria or {}
        await email_port.send(
            Email(
                to=user.email,
                subject=translate("email.capture_contact.subject"),
                text=translate(
                    "email.capture_contact.text",
                    {
                        "name": broker.display_name.split(" ")[0],
                        "owner": signup.name,
                        "phone": signup.phone_e164,
                        "email": signup.email or "",
                        "what": _summary(signup.kind, criteria),
                        "region": region_of(signup.kind, criteria) or "",
                    },
                ),
            )
        )
    return "accepted"


# ------------------------------------------------------------------ export


CSV_FIELDS = ["data", "tipo", "nome", "telefone", "email", "regiao", "origem", "pagina"]


async def export_csv(
    session: AsyncSession,
    actor: Actor,
    kind: InterestKind,
    *,
    region: str | None = None,
    origin: str | None = None,
) -> str:
    """Only people who confirmed the WhatsApp opt-in and agreed to be contacted."""
    query = select(InterestSignup).where(
        InterestSignup.kind == kind, InterestSignup.status == InterestStatus.CONFIRMED
    )
    if region:
        query = query.where(
            func.lower(cast(InterestSignup.criteria, String)).like(f"%{region.lower()}%")
        )
    if origin == "direct":
        query = query.where(InterestSignup.utm_source.is_(None))
    elif origin:
        query = query.where(func.lower(InterestSignup.utm_source) == origin.lower())
    rows = [
        r
        for r in (await session.scalars(query.order_by(InterestSignup.created_at))).all()
        if _consented(r)
    ]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_FIELDS)
    for r in rows:
        writer.writerow(
            [
                f"{format_date(r.created_at)} {format_time(r.created_at)}",
                r.kind.value,
                r.name,
                r.phone_e164,
                r.email or "",
                region_of(r.kind, r.criteria or {}) or "",
                r.utm_source or "direto",
                r.source_page or "",
            ]
        )
    record(
        session,
        actor,
        "interest.exported",
        "interest_signups",
        None,
        kind=kind.value,
        count=len(rows),
        region=region or "",
        origin=origin or "",
    )
    await session.flush()
    return buffer.getvalue()


# ------------------------------------------------------------------ property alerts (SEO pages)


async def alert_groups(session: AsyncSession, actor: Actor) -> list[AlertGroup]:
    alerts = await alerts_service.list_alerts(session)
    groups: dict[tuple[str, str, str], AlertGroup] = {}
    for a in alerts:
        if a.status.value != "active":
            continue
        key = (a.scope.value, a.scope_path, a.intent.value)
        group = groups.get(key)
        if group is None:
            groups[key] = AlertGroup(
                scope=a.scope,
                scope_name=a.scope_name,
                scope_path=a.scope_path,
                intent=a.intent,
                active=1,
                last_at=a.created_at,
            )
        else:
            group.active += 1
            group.last_at = max(group.last_at, a.created_at)
    record(session, actor, "property_alert.listed", "property_alerts", None, count=len(alerts))
    await session.flush()
    return sorted(groups.values(), key=lambda g: (-g.active, g.scope_name))
