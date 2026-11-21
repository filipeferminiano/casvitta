"""Properties, owner authorizations and publication (CLAUDE.md rules 1 and 2).

Tenant reads and writes run on a session bound to the broker's workspace. The public read model
and the daily expiry job are the only cross-tenant paths, and they apply the same gate.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.tenancy import cross_tenant
from app.core.time import today_local, utcnow
from app.domains.accounts.models import BrokerProfile, Membership, Role, Workspace
from app.domains.listings.models import Channel, Listing, ListingStatus, UnpublishReason
from app.domains.listings.rules import Blocker, BrokerFacts, publish_blockers, valid_authorization
from app.domains.properties.models import (
    AuthorizationEvidence,
    OwnerAuthorization,
    Property,
    PropertyMedia,
    PropertyStatus,
    Transaction,
)
from app.domains.properties.schemas import (
    AuthorizationIn,
    AuthorizationOut,
    ListingOut,
    MediaOut,
    PropertyIn,
    PropertyOut,
    PropertyPatch,
    PublicBroker,
    PublicListingOut,
)
from app.domains.staff.audit import Actor, record

log = get_logger(__name__)

PUBLIC_CHANNELS = frozenset({Channel.MARKETPLACE, Channel.BIO_PAGE, Channel.LANDING})
UNAVAILABLE = frozenset({PropertyStatus.SOLD, PropertyStatus.RENTED, PropertyStatus.PAUSED})

KIND_WORD = {
    "apartment": "apartamento",
    "house": "casa",
    "studio": "studio",
    "commercial": "sala",
    "land": "terreno",
}


class PropertyNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("property_not_found", status_code=404)


class PublishBlocked(AppError):
    def __init__(self, blockers: Sequence[Blocker]) -> None:
        super().__init__(f"publish_blocked.{blockers[0].value}", status_code=409)
        self.blockers = list(blockers)


def _slug_text(text: str) -> str:
    ascii_text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", ascii_text)).strip("-")[:100]


def public_slug(prop: Property) -> str:
    """Unique across the portal: workspace slugs can repeat, codes cannot."""
    return f"{prop.slug}-{prop.code.lower()}"


async def _unique_property_slug(session: AsyncSession, data: PropertyIn) -> str:
    parts = [KIND_WORD[data.kind.value], data.street or "", data.neighborhood]
    base = _slug_text(" ".join(p for p in parts if p)) or "imovel"
    taken = set(
        (await session.scalars(select(Property.slug).where(Property.slug.like(f"{base}%")))).all()
    )
    candidate, n = base, 1
    while candidate in taken:
        n += 1
        candidate = f"{base}-{n}"
    return candidate


async def _default_broker(session: AsyncSession) -> uuid.UUID | None:
    """The workspace owner's broker profile (independent brokers have exactly one)."""
    owner = await session.scalar(
        select(BrokerProfile.id)
        .join(Membership, Membership.user_id == BrokerProfile.user_id)
        .where(Membership.role == Role.OWNER)
        .limit(1)
    )
    if owner is not None:
        return owner
    return await session.scalar(select(BrokerProfile.id).limit(1))


async def _load(session: AsyncSession, property_id: uuid.UUID) -> Property:
    prop = await session.get(Property, property_id)
    if prop is None:
        raise PropertyNotFound
    return prop


async def _authorizations(
    session: AsyncSession, property_id: uuid.UUID
) -> list[OwnerAuthorization]:
    rows = await session.scalars(
        select(OwnerAuthorization).where(OwnerAuthorization.property_id == property_id)
    )
    return list(rows.all())


async def _broker_facts(session: AsyncSession, prop: Property) -> BrokerFacts | None:
    if prop.responsible_broker_id is None:
        return None
    broker = await session.get(BrokerProfile, prop.responsible_broker_id)
    return BrokerFacts(broker.creci_verified_at) if broker is not None else None


async def _workspace_paused(session: AsyncSession, workspace_id: uuid.UUID) -> bool:
    workspace = await session.get(Workspace, workspace_id)
    return workspace is not None and workspace.publishing_paused_at is not None


async def blockers_for(session: AsyncSession, prop: Property, today: date) -> list[Blocker]:
    return publish_blockers(
        prop,
        await _broker_facts(session, prop),
        await _authorizations(session, prop.id),
        today,
        workspace_paused=await _workspace_paused(session, prop.workspace_id),
    )


async def to_out(session: AsyncSession, prop: Property, today: date | None = None) -> PropertyOut:
    today = today or today_local()
    auths = await _authorizations(session, prop.id)
    current = valid_authorization(prop, auths, today) or max(
        (a for a in auths if a.revoked_at is None), key=lambda a: a.expires_at, default=None
    )
    listings = (
        await session.scalars(
            select(Listing).where(Listing.property_id == prop.id).order_by(Listing.channel)
        )
    ).all()
    media = (
        await session.scalars(
            select(PropertyMedia)
            .where(PropertyMedia.property_id == prop.id)
            .order_by(PropertyMedia.position)
        )
    ).all()
    return PropertyOut(
        id=prop.id,
        code=prop.code,
        slug=prop.slug,
        kind=prop.kind,
        transaction=prop.transaction,
        status=prop.status,
        source=prop.source,
        title=prop.title,
        description=prop.description,
        street=prop.street,
        show_street=prop.show_street,
        street_number=prop.street_number,
        complement=prop.complement,
        postal_code=prop.postal_code,
        neighborhood=prop.neighborhood,
        city=prop.city,
        state=prop.state,
        area_m2=prop.area_m2,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        parking=prop.parking,
        features=list(prop.features),
        price_cents=prop.price_cents,
        condo_fee_cents=prop.condo_fee_cents,
        iptu_monthly_cents=prop.iptu_monthly_cents,
        responsible_broker_id=prop.responsible_broker_id,
        sync_status=prop.sync_status,
        last_synced_at=prop.last_synced_at,
        is_demo=prop.is_demo,
        authorization=(
            AuthorizationOut(
                id=current.id,
                kind=current.kind,
                exclusive=current.exclusive,
                evidence=current.evidence,
                owner_name=current.owner_name,
                signed_at=current.signed_at,
                expires_at=current.expires_at,
                has_document=current.document_key is not None,
                revoked_at=current.revoked_at,
            )
            if current is not None
            else None
        ),
        listings=[ListingOut.model_validate(item) for item in listings],
        media=[MediaOut.model_validate(item) for item in media],
        blockers=await blockers_for(session, prop, today),
    )


async def create_property(session: AsyncSession, data: PropertyIn) -> Property:
    values = data.model_dump(exclude={"responsible_broker_id"})
    broker_id = data.responsible_broker_id
    if broker_id is not None and await session.get(BrokerProfile, broker_id) is None:
        raise AppError("broker_not_found", status_code=404)  # other workspace or missing
    prop = Property(
        **values,
        slug=await _unique_property_slug(session, data),
        responsible_broker_id=broker_id or await _default_broker(session),
    )
    session.add(prop)
    await session.flush()
    await session.refresh(prop)
    return prop


async def list_properties(session: AsyncSession) -> Sequence[Property]:
    return (await session.scalars(select(Property).order_by(Property.created_at.desc()))).all()


async def get_property(session: AsyncSession, property_id: uuid.UUID) -> Property:
    return await _load(session, property_id)


async def update_property(
    session: AsyncSession, property_id: uuid.UUID, patch: PropertyPatch
) -> Property:
    prop = await _load(session, property_id)
    changes = patch.model_dump(exclude_unset=True)
    status = changes.pop("status", None)
    for field, value in changes.items():
        setattr(prop, field, value)
    if status is not None:
        await set_status(session, prop, PropertyStatus(status))
    await session.flush()
    return prop


async def set_status(session: AsyncSession, prop: Property, status: PropertyStatus) -> None:
    prop.status = status
    if status in UNAVAILABLE:
        # Sold, rented or paused: off every channel now (Destaques stop delivering too).
        await _unpublish_all(session, prop.id, UnpublishReason.PROPERTY_UNAVAILABLE)


async def add_authorization(
    session: AsyncSession,
    property_id: uuid.UUID,
    data: AuthorizationIn,
    user_id: uuid.UUID,
    document_key: str | None = None,
) -> OwnerAuthorization:
    prop = await _load(session, property_id)
    if data.evidence == AuthorizationEvidence.DOCUMENT and document_key is None:
        raise AppError("authorization_document_missing", status_code=422)
    auth = OwnerAuthorization(
        property_id=prop.id,
        kind=data.kind,
        exclusive=data.exclusive,
        evidence=data.evidence,
        owner_name=data.owner_name,
        document_key=document_key,
        attested_by_user_id=user_id if data.evidence == AuthorizationEvidence.ATTESTATION else None,
        signed_at=data.signed_at,
        expires_at=data.expires_at,
    )
    session.add(auth)
    await session.flush()
    return auth


async def publish(
    session: AsyncSession, property_id: uuid.UUID, channel: Channel, today: date | None = None
) -> Listing:
    prop = await _load(session, property_id)
    blockers = await blockers_for(session, prop, today or today_local())
    if blockers:
        raise PublishBlocked(blockers)
    listing = await session.scalar(
        select(Listing).where(Listing.property_id == prop.id, Listing.channel == channel)
    )
    if listing is None:
        listing = Listing(property_id=prop.id, channel=channel)
        session.add(listing)
    if listing.status == ListingStatus.SUSPENDED:
        raise AppError("listing_suspended", status_code=409)  # only staff lift a suspension
    if listing.status != ListingStatus.PUBLISHED:
        listing.status = ListingStatus.PUBLISHED
        listing.published_at = utcnow()
        listing.unpublished_at = None
        listing.unpublish_reason = None
    await session.flush()
    return listing


async def unpublish(session: AsyncSession, property_id: uuid.UUID, channel: Channel) -> None:
    prop = await _load(session, property_id)
    listing = await session.scalar(
        select(Listing).where(Listing.property_id == prop.id, Listing.channel == channel)
    )
    if listing is not None and listing.status == ListingStatus.PUBLISHED:
        _mark_unpublished(listing, UnpublishReason.BROKER)
    await session.flush()


def _mark_unpublished(listing: Listing, reason: UnpublishReason) -> None:
    listing.status = ListingStatus.UNPUBLISHED
    listing.unpublished_at = utcnow()
    listing.unpublish_reason = reason


async def _unpublish_all(
    session: AsyncSession, property_id: uuid.UUID, reason: UnpublishReason
) -> int:
    rows = (
        await session.scalars(
            select(Listing).where(
                Listing.property_id == property_id, Listing.status == ListingStatus.PUBLISHED
            )
        )
    ).all()
    for listing in rows:
        _mark_unpublished(listing, reason)
    return len(rows)


async def expire_authorizations(session: AsyncSession, today: date | None = None) -> int:
    """Daily job: unpublish every listing whose property has no valid authorization (rule 2)."""
    today = today or today_local()
    count = 0
    with cross_tenant(session):
        published = (
            await session.scalars(
                select(Property)
                .join(Listing, Listing.property_id == Property.id)
                .where(Listing.status == ListingStatus.PUBLISHED)
                .distinct()
            )
        ).all()
        for prop in published:
            auths = await _authorizations(session, prop.id)
            if valid_authorization(prop, auths, today) is not None:
                continue
            n = await _unpublish_all(session, prop.id, UnpublishReason.AUTHORIZATION_EXPIRED)
            record(
                session,
                Actor.system(),
                "listing.unpublished",
                "property",
                prop.id,
                reason="authorization_expired",
                listings=n,
            )
            count += n
        await session.flush()
    log.info("authorizations_expired", listings=count)
    return count


async def public_listings(
    session: AsyncSession,
    channel: Channel,
    *,
    include_demo: bool = False,
    workspace_id: uuid.UUID | None = None,
    transaction: Transaction | None = None,
    city: str | None = None,
    neighborhood: str | None = None,
    street: str | None = None,
    today: date | None = None,
    limit: int = 500,
) -> list[PublicListingOut]:
    """Published listings that pass the gate right now (CRECI verified, valid authorization)."""
    if channel not in PUBLIC_CHANNELS:
        raise ValueError(f"{channel} is not a public channel")
    today = today or today_local()
    with cross_tenant(session):
        query = (
            select(Property, BrokerProfile, Listing)
            .join(Listing, Listing.property_id == Property.id)
            .join(BrokerProfile, BrokerProfile.id == Property.responsible_broker_id)
            .join(Workspace, Workspace.id == Property.workspace_id)
            .where(
                Listing.channel == channel,
                Listing.status == ListingStatus.PUBLISHED,
                Property.status == PropertyStatus.ACTIVE,
                BrokerProfile.creci_verified_at.is_not(None),
                Workspace.publishing_paused_at.is_(None),
            )
            .order_by(Listing.published_at.desc())
            .limit(limit)
        )
        if not include_demo:
            query = query.where(Property.is_demo.is_(False))
        if workspace_id is not None:
            query = query.where(Property.workspace_id == workspace_id)
        if transaction is not None:
            query = query.where(Property.transaction == transaction)
        # Place filters compare URL slugs ("sao-paulo", "vila-mariana"); the street filter only
        # matches when the broker shows the street publicly.
        wanted = {"city": city, "neighborhood": neighborhood, "street": street}
        rows = [
            row
            for row in (await session.execute(query)).all()
            if all(
                value is None
                or (
                    getattr(row[0], field) is not None
                    and _slug_text(getattr(row[0], field)) == value
                )
                for field, value in wanted.items()
            )
            and (street is None or row[0].show_street)
        ]
        ids = [prop.id for prop, _, _ in rows]
        auths_by_property: dict[uuid.UUID, list[OwnerAuthorization]] = {}
        photos_by_property: dict[uuid.UUID, list[str]] = {}
        if ids:
            for auth in await session.scalars(
                select(OwnerAuthorization).where(OwnerAuthorization.property_id.in_(ids))
            ):
                auths_by_property.setdefault(auth.property_id, []).append(auth)
            for media in await session.scalars(
                select(PropertyMedia)
                .where(PropertyMedia.property_id.in_(ids))
                .order_by(PropertyMedia.is_cover.desc(), PropertyMedia.position)
            ):
                photos_by_property.setdefault(media.property_id, []).append(media.url)
        out: list[PublicListingOut] = []
        for prop, broker, listing in rows:
            if valid_authorization(prop, auths_by_property.get(prop.id, []), today) is None:
                continue  # expired today; the daily job will unpublish it
            photos = photos_by_property.get(prop.id, [])
            out.append(
                PublicListingOut(
                    code=prop.code,
                    slug=public_slug(prop),
                    kind=prop.kind,
                    transaction=prop.transaction,
                    title=prop.title,
                    description=prop.description,
                    street=prop.street if prop.show_street else None,
                    neighborhood=prop.neighborhood,
                    city=prop.city,
                    state=prop.state,
                    area_m2=prop.area_m2,
                    bedrooms=prop.bedrooms,
                    bathrooms=prop.bathrooms,
                    parking=prop.parking,
                    features=list(prop.features),
                    price_cents=prop.price_cents,
                    condo_fee_cents=prop.condo_fee_cents,
                    iptu_monthly_cents=prop.iptu_monthly_cents,
                    photos=list(photos),
                    broker=PublicBroker(
                        display_name=broker.display_name,
                        slug=broker.slug,
                        creci_state=broker.creci_state or "",
                        creci_number=broker.creci_number or "",
                        photo_url=broker.photo_url,
                    ),
                    published_at=listing.published_at,
                )
            )
    return out
