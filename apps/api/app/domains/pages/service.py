"""Casvitta Social (SOC-1a): the broker page, its onboarding, public read, visit counters, QR code.

The page reads the broker profile and the properties published on the `bio_page` channel; the
same publication gate as the portal applies to each property (verified CRECI, staff-checked owner
authorization). The page itself goes public only with a verified CRECI unless
`page_requires_verified_creci` is off (CLAUDE.md rule 1).
"""

from __future__ import annotations

import hashlib
import io
import re
import uuid
from datetime import timedelta
from urllib.parse import urlsplit

import segno
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import Feature, has_feature
from app.core.errors import AppError
from app.core.settings import Settings
from app.core.tenancy import bind_workspace, cross_tenant
from app.core.time import today_local, utcnow
from app.domains.accounts.models import BrokerProfile, Workspace
from app.domains.accounts.service import creci_status
from app.domains.listings.models import Channel, Listing, ListingStatus
from app.domains.pages.models import (
    BrokerPage,
    PageEvent,
    PageEventKind,
    PageSource,
    PageStatus,
)
from app.domains.pages.schemas import (
    PageBlocker,
    PageChecklist,
    PageEventIn,
    PageOut,
    PageStatsOut,
    PageUpdate,
    PublicPageOut,
)
from app.domains.properties import service as properties

# Crawlers and link previews are not visits.
_BOT = re.compile(
    r"bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|embedly|headless|lighthouse",
    re.IGNORECASE,
)


class NoBrokerProfile(AppError):
    def __init__(self) -> None:
        super().__init__("no_broker_profile", status_code=409)


class PageNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("not_found", status_code=404)


def page_url(settings: Settings, slug: str) -> str:
    """{slug}.casvitta.com.br (http://{slug}.localhost:3000 in development)."""
    parts = urlsplit(settings.site_url)
    host = parts.netloc.removeprefix("www.")
    return f"{parts.scheme}://{slug}.{host}"


def creci_line(profile: BrokerProfile) -> str | None:
    if not profile.creci_number:
        return None
    kind = profile.creci_kind.value if profile.creci_kind else "F"
    return f"CRECI-{profile.creci_state or ''} {profile.creci_number}-{kind}"


async def _profile(session: AsyncSession, user_id: uuid.UUID) -> BrokerProfile:
    profile = await session.scalar(select(BrokerProfile).where(BrokerProfile.user_id == user_id))
    if profile is None:
        raise NoBrokerProfile
    return profile


async def get_or_create(
    session: AsyncSession, user_id: uuid.UUID
) -> tuple[BrokerPage, BrokerProfile]:
    profile = await _profile(session, user_id)
    page = await session.scalar(
        select(BrokerPage).where(BrokerPage.broker_profile_id == profile.id)
    )
    if page is None:
        await session.execute(
            pg_insert(BrokerPage)
            .values(
                id=uuid.uuid4(), workspace_id=profile.workspace_id, broker_profile_id=profile.id
            )
            .on_conflict_do_nothing(index_elements=["broker_profile_id"])
        )
        page = await session.scalar(
            select(BrokerPage).where(BrokerPage.broker_profile_id == profile.id)
        )
        if page is None:  # pragma: no cover - the insert above guarantees the row
            raise NoBrokerProfile
    return page, profile


def blockers(profile: BrokerProfile) -> list[PageBlocker]:
    out: list[PageBlocker] = []
    if not profile.display_name.strip():
        out.append("display_name_missing")
    if not profile.whatsapp_e164:
        out.append("whatsapp_missing")
    if not profile.creci_number:
        out.append("creci_missing")
    return out


def is_live(page: BrokerPage, profile: BrokerProfile, settings: Settings) -> bool:
    if page.status != PageStatus.PUBLISHED:
        return False
    return profile.creci_verified_at is not None or not settings.page_requires_verified_creci


async def _bio_listing_count(session: AsyncSession, profile: BrokerProfile) -> int:
    from app.domains.properties.models import Property  # noqa: PLC0415 - local to keep imports flat

    return (
        await session.scalar(
            select(func.count())
            .select_from(Listing)
            .join(Property, Property.id == Listing.property_id)
            .where(
                Listing.channel == Channel.BIO_PAGE,
                Listing.status.in_((ListingStatus.PUBLISHED, ListingStatus.PENDING_REVIEW)),
                Property.responsible_broker_id == profile.id,
            )
        )
        or 0
    )


async def plan_has(session: AsyncSession, workspace_id: uuid.UUID, feature: Feature) -> bool:
    workspace = await session.get(Workspace, workspace_id)
    return workspace is not None and has_feature(workspace.plan, feature)


async def _plan_branded(session: AsyncSession, workspace_id: uuid.UUID) -> bool:
    return not await plan_has(session, workspace_id, Feature.UNBRANDED_PAGE)


async def to_out(
    session: AsyncSession, page: BrokerPage, profile: BrokerProfile, settings: Settings
) -> PageOut:
    viewed = await session.scalar(select(PageEvent.id).where(PageEvent.page_id == page.id).limit(1))
    return PageOut(
        slug=profile.slug,
        url=page_url(settings, profile.slug),
        theme=page.theme,
        works_as=page.works_as,
        agency_name=page.agency_name,
        status=page.status,
        is_live=is_live(page, profile, settings),
        published_at=page.published_at,
        suspended_reason=page.suspended_reason,
        onboarding_step=page.onboarding_step,
        onboarding_done=page.onboarding_done_at is not None,
        onboarding_dismissed=page.onboarding_dismissed_at is not None,
        display_name=profile.display_name,
        photo_url=profile.photo_url,
        bio=profile.bio,
        regions=list(profile.regions or []),
        whatsapp_e164=profile.whatsapp_e164,
        creci=creci_line(profile),
        creci_status=creci_status(profile),
        blockers=blockers(profile),
        checklist=PageChecklist(
            profile_photo=profile.photo_url is not None,
            bio=bool(profile.bio),
            creci_verified=profile.creci_verified_at is not None,
            has_properties=await _bio_listing_count(session, profile) > 0,
            published=page.status == PageStatus.PUBLISHED,
            link_used=viewed is not None,
        ),
        branded=await _plan_branded(session, page.workspace_id),
        forms=await plan_has(session, page.workspace_id, Feature.TRACKED_FORMS),
    )


async def update(
    session: AsyncSession, page: BrokerPage, profile: BrokerProfile, data: PageUpdate
) -> None:
    changes = data.model_dump(exclude_unset=True)
    for field in ("theme", "works_as"):
        if changes.get(field) is not None:
            setattr(page, field, changes[field])
    if "agency_name" in changes:
        page.agency_name = (changes["agency_name"] or "").strip() or None
    if changes.get("display_name"):
        profile.display_name = changes["display_name"].strip()
    if "bio" in changes:
        profile.bio = (changes["bio"] or "").strip() or None
    if changes.get("regions") is not None:
        profile.regions = changes["regions"]
    if changes.get("whatsapp"):
        profile.whatsapp_e164 = changes["whatsapp"]
    if data.onboarding_step is not None:
        page.onboarding_step = max(page.onboarding_step, data.onboarding_step)
    now = utcnow()
    if data.onboarding_done:
        page.onboarding_done_at = page.onboarding_done_at or now
    if data.onboarding_dismissed is not None:
        page.onboarding_dismissed_at = now if data.onboarding_dismissed else None
    await session.flush()


async def publish(session: AsyncSession, page: BrokerPage, profile: BrokerProfile) -> None:
    if page.status == PageStatus.SUSPENDED:
        raise AppError("page_suspended", status_code=409)  # only staff lift a suspension
    found = blockers(profile)
    if found:
        raise AppError("page_blocked", status_code=409)
    workspace = await session.get(Workspace, page.workspace_id)
    if workspace is not None and workspace.publishing_paused_at is not None:
        raise AppError("publishing_paused", status_code=409)
    if page.status != PageStatus.PUBLISHED:
        page.status = PageStatus.PUBLISHED
        page.published_at = page.published_at or utcnow()
        page.unpublished_at = None
    await session.flush()


async def unpublish(session: AsyncSession, page: BrokerPage) -> None:
    if page.status == PageStatus.PUBLISHED:
        page.status = PageStatus.UNPUBLISHED
        page.unpublished_at = utcnow()
    await session.flush()


async def live_page(
    session: AsyncSession, slug: str, settings: Settings
) -> tuple[BrokerPage, BrokerProfile] | None:
    with cross_tenant(session):
        row = (
            await session.execute(
                select(BrokerPage, BrokerProfile, Workspace)
                .join(BrokerProfile, BrokerProfile.id == BrokerPage.broker_profile_id)
                .join(Workspace, Workspace.id == BrokerPage.workspace_id)
                .where(BrokerProfile.slug == slug.lower())
            )
        ).first()
    if row is None:
        return None
    page, profile, workspace = row
    if not is_live(page, profile, settings) or workspace.publishing_paused_at is not None:
        return None
    if profile.is_demo and not settings.public_listings_include_demo:
        return None  # demo data never reaches real pages (rule 7)
    return page, profile


async def public_page(session: AsyncSession, slug: str, settings: Settings) -> PublicPageOut:
    found = await live_page(session, slug, settings)
    if found is None:
        raise PageNotFound
    page, profile = found
    listings = await properties.public_listings(
        session,
        Channel.BIO_PAGE,
        include_demo=settings.public_listings_include_demo,
        broker_profile_id=profile.id,
        limit=60,
    )
    with cross_tenant(session):
        branded = await _plan_branded(session, page.workspace_id)
        forms = await plan_has(session, page.workspace_id, Feature.TRACKED_FORMS)
    return PublicPageOut(
        slug=profile.slug,
        theme=page.theme,
        display_name=profile.display_name,
        works_as=page.works_as,
        agency_name=page.agency_name,
        photo_url=profile.photo_url,
        bio=profile.bio,
        regions=list(profile.regions or []),
        whatsapp_e164=profile.whatsapp_e164,
        creci=creci_line(profile),
        creci_verified=profile.creci_verified_at is not None,
        branded=branded,
        is_demo=profile.is_demo,
        forms=forms,
        properties=listings,
    )


def visitor_key(client: str, user_agent: str, settings: Settings) -> str:
    """Salted daily hash: counts a visitor once a day without keeping the IP."""
    salt = settings.jwt_secret.get_secret_value()
    raw = f"{salt}|{today_local().isoformat()}|{client}|{user_agent}"
    return hashlib.sha256(raw.encode()).hexdigest()


def is_bot(user_agent: str) -> bool:
    return not user_agent or bool(_BOT.search(user_agent))


async def record_event(
    session: AsyncSession,
    slug: str,
    data: PageEventIn,
    *,
    client: str,
    user_agent: str,
    settings: Settings,
) -> None:
    if is_bot(user_agent):
        return
    found = await live_page(session, slug, settings)
    if found is None:
        raise PageNotFound
    page, _ = found
    bind_workspace(session, page.workspace_id)
    await insert_event(
        session,
        page,
        kind=data.kind,
        source=data.source,
        property_code=data.property_code,
        key=visitor_key(client, user_agent, settings),
    )


async def insert_event(
    session: AsyncSession,
    page: BrokerPage,
    *,
    kind: PageEventKind,
    source: PageSource,
    property_code: str | None,
    key: str,
) -> None:
    await session.execute(
        pg_insert(PageEvent)
        .values(
            id=uuid.uuid4(),
            workspace_id=page.workspace_id,
            page_id=page.id,
            kind=kind,
            source=source,
            property_code=property_code or "",
            visitor_key=key,
            day=today_local(),
            occurred_at=utcnow(),
        )
        .on_conflict_do_nothing(constraint="uq_page_events_daily")
    )


async def stats(session: AsyncSession, page: BrokerPage, days: int = 30) -> PageStatsOut:
    since = today_local() - timedelta(days=days - 1)
    rows = (
        await session.execute(
            select(PageEvent.kind, PageEvent.source, func.count())
            .where(PageEvent.page_id == page.id, PageEvent.day >= since)
            .group_by(PageEvent.kind, PageEvent.source)
        )
    ).all()
    by_kind = dict.fromkeys(PageEventKind, 0)
    by_source = dict.fromkeys(PageSource, 0)
    for kind, source, count in rows:
        by_kind[kind] += count
        if kind == PageEventKind.PAGE_VIEW:
            by_source[source] += count
    return PageStatsOut(
        days=days,
        page_views=by_kind[PageEventKind.PAGE_VIEW],
        property_views=by_kind[PageEventKind.PROPERTY_VIEW],
        whatsapp_clicks=by_kind[PageEventKind.WHATSAPP_CLICK],
        forms_submitted=by_kind[PageEventKind.FORM_SUBMITTED],
        by_source=by_source,
    )


def qr_code(url: str, kind: str) -> bytes:
    """PNG (screens, social) or PDF (print). The QR opens the page with ?origem=qr."""
    qr = segno.make(f"{url}/?origem=qr", error="m")
    out = io.BytesIO()
    if kind == "pdf":
        qr.save(out, kind="pdf", scale=12, border=4)
    else:
        qr.save(out, kind="png", scale=16, border=4, dark="#0F1E3D")
    return out.getvalue()
