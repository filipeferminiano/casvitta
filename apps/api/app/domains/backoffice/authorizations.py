"""Conferência de autorizações (BO6, CRM mockup 04): staff check the owner's authorization before
a listing goes public. Verifying puts the waiting listings live; rejecting keeps them off with a
reason the broker sees. Every decision and every document view is audited.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import BrokerProfile, Workspace
from app.domains.activity.models import EventActor, KeyEvent, KeyEventKind, is_activity
from app.domains.listings.models import Listing, ListingStatus, UnpublishReason
from app.domains.properties.models import (
    AuthorizationEvidence,
    AuthorizationReview,
    OwnerAuthorization,
    Property,
    Transaction,
)
from app.domains.staff.audit import Actor, record


class AuthorizationItem(BaseModel):
    id: uuid.UUID
    property_code: str
    property_title: str
    neighborhood: str
    city: str
    transaction: Transaction
    workspace_name: str
    broker_name: str | None
    owner_name: str
    evidence: AuthorizationEvidence
    has_document: bool
    exclusive: bool
    signed_at: date
    expires_at: date
    submitted_at: datetime
    waiting_listings: int
    is_demo: bool


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class AuthorizationNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("authorization_not_found", status_code=404)


async def queue(session: AsyncSession) -> list[AuthorizationItem]:
    with cross_tenant(session):
        rows = (
            await session.execute(
                select(OwnerAuthorization, Property, Workspace.name, BrokerProfile.display_name)
                .join(Property, Property.id == OwnerAuthorization.property_id)
                .join(Workspace, Workspace.id == Property.workspace_id)
                .outerjoin(BrokerProfile, BrokerProfile.id == Property.responsible_broker_id)
                .where(
                    OwnerAuthorization.review_status == AuthorizationReview.PENDING,
                    OwnerAuthorization.revoked_at.is_(None),
                )
                .order_by(OwnerAuthorization.created_at)
            )
        ).all()
        waiting: dict[uuid.UUID, int] = {}
        ids = [p.id for _, p, _, _ in rows]
        if ids:
            for listing in await session.scalars(
                select(Listing).where(
                    Listing.property_id.in_(ids), Listing.status == ListingStatus.PENDING_REVIEW
                )
            ):
                waiting[listing.property_id] = waiting.get(listing.property_id, 0) + 1
    return [
        AuthorizationItem(
            id=a.id,
            property_code=p.code,
            property_title=p.title or f"{p.kind.value} · {p.neighborhood}",
            neighborhood=p.neighborhood,
            city=p.city,
            transaction=p.transaction,
            workspace_name=w,
            broker_name=b,
            owner_name=a.owner_name,
            evidence=a.evidence,
            has_document=a.document_key is not None,
            exclusive=a.exclusive,
            signed_at=a.signed_at,
            expires_at=a.expires_at,
            submitted_at=a.created_at,
            waiting_listings=waiting.get(p.id, 0),
            is_demo=p.is_demo,
        )
        # Listings waiting on the check come first.
        for a, p, w, b in sorted(rows, key=lambda r: -waiting.get(r[1].id, 0))
    ]


async def _load(session: AsyncSession, auth_id: uuid.UUID) -> tuple[OwnerAuthorization, Property]:
    with cross_tenant(session):
        auth = await session.get(OwnerAuthorization, auth_id)
        prop = await session.get(Property, auth.property_id) if auth else None
    if auth is None or prop is None or auth.review_status != AuthorizationReview.PENDING:
        raise AuthorizationNotFound
    return auth, prop


async def verify(session: AsyncSession, actor: Actor, auth_id: uuid.UUID) -> int:
    """Returns how many listings went live."""
    auth, prop = await _load(session, auth_id)
    with cross_tenant(session):
        auth.review_status = AuthorizationReview.VERIFIED
        auth.reviewed_at = utcnow()
        auth.reviewed_by_staff_id = actor.staff_id
        waiting = (
            await session.scalars(
                select(Listing).where(
                    Listing.property_id == prop.id, Listing.status == ListingStatus.PENDING_REVIEW
                )
            )
        ).all()
        for listing in waiting:
            listing.status = ListingStatus.PUBLISHED
            listing.published_at = utcnow()
            session.add(
                KeyEvent(
                    workspace_id=prop.workspace_id,
                    kind=KeyEventKind.PROPERTY_PUBLISHED,
                    actor=EventActor.SYSTEM,
                    entity="property",
                    entity_id=str(prop.id),
                    is_activity=is_activity(KeyEventKind.PROPERTY_PUBLISHED, EventActor.SYSTEM),
                    payload={"channel": listing.channel.value, "after": "authorization_verified"},
                    occurred_at=utcnow(),
                )
            )
        record(
            session,
            actor,
            "authorization.verified",
            "property",
            prop.id,
            authorization_id=str(auth.id),
            listings=len(waiting),
        )
        await session.flush()
    return len(waiting)


async def reject(session: AsyncSession, actor: Actor, auth_id: uuid.UUID, reason: str) -> None:
    auth, prop = await _load(session, auth_id)
    with cross_tenant(session):
        auth.review_status = AuthorizationReview.REJECTED
        auth.review_reason = reason
        auth.reviewed_at = utcnow()
        auth.reviewed_by_staff_id = actor.staff_id
        for listing in await session.scalars(
            select(Listing).where(
                Listing.property_id == prop.id, Listing.status == ListingStatus.PENDING_REVIEW
            )
        ):
            listing.status = ListingStatus.UNPUBLISHED
            listing.unpublished_at = utcnow()
            listing.unpublish_reason = UnpublishReason.STAFF
        record(
            session,
            actor,
            "authorization.rejected",
            "property",
            prop.id,
            reason=reason,
            authorization_id=str(auth.id),
        )
        await session.flush()


async def document_key(session: AsyncSession, actor: Actor, auth_id: uuid.UUID) -> str:
    """The stored document, for staff to read. Opening it is audited."""
    with cross_tenant(session):
        auth = await session.get(OwnerAuthorization, auth_id)
    if auth is None or auth.document_key is None:
        raise AuthorizationNotFound
    record(session, actor, "authorization.document_viewed", "property", auth.property_id)
    await session.flush()
    return auth.document_key
