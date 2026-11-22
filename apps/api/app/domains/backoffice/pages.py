"""Páginas e domínios (Casvitta Social, mockup social/31): visitor reports and pages that need a
look, and the staff actions on a broker page.

Staff can suspend a page (reason required, sent to the broker and kept in the audit log), lift a
suspension and dismiss a report. The people who contacted a broker through the page are the
broker's: nothing here reads Interessados (contacts), only counts of page visits.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.i18n import translate
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import today_local, utcnow
from app.domains.accounts.models import BrokerProfile, Plan, User, Workspace
from app.domains.listings.models import Channel
from app.domains.pages import service as pages
from app.domains.pages.models import (
    BrokerPage,
    PageEvent,
    PageEventKind,
    PageReport,
    PageStatus,
    ReportReason,
    ReportStatus,
)
from app.domains.properties import service as properties
from app.domains.staff.audit import Actor, record
from app.integrations.messaging.port import Email, EmailPort

Tab = Literal["review", "published", "suspended"]
Signal = Literal["report", "creci_unverified"]
LIMIT = 200


class ReasonIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def _clean(cls, value: str) -> str:
        return " ".join(value.split())


class PageRow(BaseModel):
    page_id: uuid.UUID
    slug: str
    url: str
    display_name: str
    plan: Plan
    status: PageStatus
    creci_verified: bool
    published_at: datetime | None
    open_reports: int
    # Why it is in "Para revisar": the most recent report, or a published page without a
    # verified CRECI (its properties are hidden until BO2 verifies).
    signal: Signal | None
    signal_reason: ReportReason | None
    signal_text: str | None
    signal_at: datetime | None
    suspended_reason: str | None
    is_demo: bool


class PagesQueueOut(BaseModel):
    counts: dict[str, int]  # review, reports, published, suspended
    items: list[PageRow]


class ReportOut(BaseModel):
    id: uuid.UUID
    reason: ReportReason
    details: str | None
    status: ReportStatus
    created_at: datetime
    reviewed_at: datetime | None
    review_note: str | None


class PageDetailOut(BaseModel):
    page: PageRow
    visible_properties: int
    visits_24h: int
    reports: list[ReportOut]


def _row(  # noqa: PLR0917 - one row from the joined records
    page: BrokerPage,
    profile: BrokerProfile,
    workspace: Workspace,
    settings: Settings,
    open_reports: int,
    latest: PageReport | None,
) -> PageRow:
    signal: Signal | None = None
    if latest is not None:
        signal = "report"
    elif page.status == PageStatus.PUBLISHED and profile.creci_verified_at is None:
        signal = "creci_unverified"
    return PageRow(
        page_id=page.id,
        slug=profile.slug,
        url=pages.page_url(settings, profile.slug),
        display_name=profile.display_name,
        plan=workspace.plan,
        status=page.status,
        creci_verified=profile.creci_verified_at is not None,
        published_at=page.published_at,
        open_reports=open_reports,
        signal=signal,
        signal_reason=latest.reason if latest else None,
        signal_text=latest.details if latest else None,
        signal_at=latest.created_at if latest else page.published_at,
        suspended_reason=page.suspended_reason,
        is_demo=profile.is_demo,
    )


def _base() -> Select[BrokerPage, BrokerProfile, Workspace]:
    return (
        select(BrokerPage, BrokerProfile, Workspace)
        .join(BrokerProfile, BrokerProfile.id == BrokerPage.broker_profile_id)
        .join(Workspace, Workspace.id == BrokerPage.workspace_id)
    )


_open = select(PageReport.page_id).where(PageReport.status == ReportStatus.OPEN)
_unverified = (BrokerPage.status == PageStatus.PUBLISHED) & BrokerProfile.creci_verified_at.is_(
    None
)


def _tab_filter(tab: Tab):  # type: ignore[no-untyped-def]
    if tab == "published":
        return BrokerPage.status == PageStatus.PUBLISHED
    if tab == "suspended":
        return BrokerPage.status == PageStatus.SUSPENDED
    return BrokerPage.id.in_(_open) | _unverified


async def _counts(session: AsyncSession) -> dict[str, int]:
    async def count(cond) -> int:  # type: ignore[no-untyped-def]
        query = (
            select(func.count())
            .select_from(BrokerPage)
            .join(BrokerProfile, BrokerProfile.id == BrokerPage.broker_profile_id)
            .where(cond)
        )
        return int(await session.scalar(query) or 0)

    return {
        "review": await count(_tab_filter("review")),
        "reports": int(
            await session.scalar(
                select(func.count())
                .select_from(PageReport)
                .where(PageReport.status == ReportStatus.OPEN)
            )
            or 0
        ),
        "published": await count(_tab_filter("published")),
        "suspended": await count(_tab_filter("suspended")),
    }


async def _report_state(
    session: AsyncSession, page_ids: list[uuid.UUID]
) -> tuple[dict[uuid.UUID, int], dict[uuid.UUID, PageReport]]:
    counts: dict[uuid.UUID, int] = {}
    latest: dict[uuid.UUID, PageReport] = {}
    if not page_ids:
        return counts, latest
    for report in await session.scalars(
        select(PageReport)
        .where(PageReport.page_id.in_(page_ids), PageReport.status == ReportStatus.OPEN)
        .order_by(PageReport.created_at)
    ):
        counts[report.page_id] = counts.get(report.page_id, 0) + 1
        latest[report.page_id] = report  # newest wins
    return counts, latest


async def queue(session: AsyncSession, actor: Actor, tab: Tab, settings: Settings) -> PagesQueueOut:
    with cross_tenant(session):
        rows = (
            await session.execute(
                _base()
                .where(_tab_filter(tab))
                .order_by(BrokerPage.published_at.desc().nulls_last())
                .limit(LIMIT)
            )
        ).all()
        counts, latest = await _report_state(session, [r[0].id for r in rows])
        items = [
            _row(p, prof, ws, settings, counts.get(p.id, 0), latest.get(p.id))
            for p, prof, ws in rows
        ]
        if tab == "review":  # reports first, newest signal first
            items.sort(
                key=lambda i: (
                    i.signal != "report",
                    -(i.signal_at.timestamp() if i.signal_at else 0),
                )
            )
        out = PagesQueueOut(counts=await _counts(session), items=items)
    record(session, actor, "pages.queue_viewed", "broker_page", tab=tab)
    return out


async def _load(
    session: AsyncSession, page_id: uuid.UUID
) -> tuple[BrokerPage, BrokerProfile, Workspace]:
    row = (await session.execute(_base().where(BrokerPage.id == page_id))).first()
    if row is None:
        raise AppError("not_found", status_code=404)
    return row[0], row[1], row[2]


async def detail(
    session: AsyncSession, actor: Actor, page_id: uuid.UUID, settings: Settings
) -> PageDetailOut:
    with cross_tenant(session):
        page, profile, workspace = await _load(session, page_id)
        counts, latest = await _report_state(session, [page.id])
        reports = (
            await session.scalars(
                select(PageReport)
                .where(PageReport.page_id == page.id)
                .order_by(PageReport.created_at.desc())
                .limit(50)
            )
        ).all()
        visits = await session.scalar(
            select(func.count())
            .select_from(PageEvent)
            .where(
                PageEvent.page_id == page.id,
                PageEvent.kind == PageEventKind.PAGE_VIEW,
                PageEvent.day >= today_local() - timedelta(days=1),
            )
        )
    visible = await properties.public_listings(
        session,
        Channel.BIO_PAGE,
        include_demo=settings.public_listings_include_demo,
        broker_profile_id=profile.id,
        limit=500,
    )
    record(session, actor, "pages.viewed", "broker_page", page.id)
    return PageDetailOut(
        page=_row(page, profile, workspace, settings, counts.get(page.id, 0), latest.get(page.id)),
        visible_properties=len(visible),
        visits_24h=int(visits or 0),
        reports=[
            ReportOut(
                id=r.id,
                reason=r.reason,
                details=r.details,
                status=r.status,
                created_at=r.created_at,
                reviewed_at=r.reviewed_at,
                review_note=r.review_note,
            )
            for r in reports
        ],
    )


async def _close_reports(
    session: AsyncSession, page: BrokerPage, status: ReportStatus, note: str
) -> int:
    reports = (
        await session.scalars(
            select(PageReport).where(
                PageReport.page_id == page.id, PageReport.status == ReportStatus.OPEN
            )
        )
    ).all()
    for r in reports:
        r.status = status
        r.reviewed_at = utcnow()
        r.review_note = note
    return len(reports)


async def suspend(
    session: AsyncSession,
    actor: Actor,
    page_id: uuid.UUID,
    reason: str,
    *,
    email_port: EmailPort,
    settings: Settings,
) -> PageDetailOut:
    """Takes the page off the air; only staff can lift it. The broker gets the reason by email."""
    with cross_tenant(session):
        page, profile, _ = await _load(session, page_id)
        if page.status == PageStatus.SUSPENDED:
            raise AppError("page_already_suspended", status_code=409)
        previous = page.status
        page.status = PageStatus.SUSPENDED
        page.suspended_reason = reason
        page.unpublished_at = utcnow()
        closed = await _close_reports(session, page, ReportStatus.ACTIONED, reason)
        user = await session.get(User, profile.user_id)
        record(
            session,
            actor,
            "pages.suspended",
            "broker_page",
            page.id,
            reason=reason,
            slug=profile.slug,
            previous_status=previous.value,
            reports_closed=closed,
        )
        await session.flush()
    if user is not None:
        await email_port.send(
            Email(
                to=user.email,
                subject=translate("email.page_suspended.subject"),
                text=translate(
                    "email.page_suspended.text",
                    {
                        "name": profile.display_name.split(" ")[0],
                        "url": pages.page_url(settings, profile.slug),
                        "reason": reason,
                    },
                ),
            )
        )
    return await detail(session, actor, page_id, settings)


async def reactivate(
    session: AsyncSession, actor: Actor, page_id: uuid.UUID, reason: str, settings: Settings
) -> PageDetailOut:
    """Lifts a suspension. The page comes back off the air: the broker turns it on again."""
    with cross_tenant(session):
        page, profile, _ = await _load(session, page_id)
        if page.status != PageStatus.SUSPENDED:
            raise AppError("page_not_suspended", status_code=409)
        page.status = PageStatus.UNPUBLISHED
        page.suspended_reason = None
        record(
            session,
            actor,
            "pages.reactivated",
            "broker_page",
            page.id,
            reason=reason,
            slug=profile.slug,
        )
        await session.flush()
    return await detail(session, actor, page_id, settings)


async def dismiss_report(
    session: AsyncSession,
    actor: Actor,
    report_id: uuid.UUID,
    reason: str,
    settings: Settings,
) -> PageDetailOut:
    with cross_tenant(session):
        report_row = await session.get(PageReport, report_id)
        if report_row is None or report_row.status != ReportStatus.OPEN:
            raise AppError("report_not_found", status_code=404)
        report_row.status = ReportStatus.DISMISSED
        report_row.reviewed_at = utcnow()
        report_row.review_note = reason
        record(
            session,
            actor,
            "pages.report_dismissed",
            "page_report",
            report_row.id,
            reason=reason,
            page_id=str(report_row.page_id),
        )
        await session.flush()
        page_id = report_row.page_id
    return await detail(session, actor, page_id, settings)
