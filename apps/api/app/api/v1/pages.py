"""Casvitta Social (SOC-1a): Minha página (broker) and the public page read. Thin router."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import (
    client_key,
    get_claims,
    get_rate_limiter,
    get_settings_dep,
    get_tenant_session,
)
from app.api.v1.properties import IMAGE_TYPES, _read_upload
from app.core.db import get_session
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.core.security import AccessClaims
from app.core.settings import Settings
from app.domains.pages import collections, domains, inquiries, service
from app.domains.pages.collections import PageCollectionsIn, PageCollectionsOut
from app.domains.pages.inquiries import PageInquiryAccepted, PageInquiryIn
from app.domains.pages.schemas import (
    PageEventIn,
    PageOut,
    PageReportIn,
    PageStatsOut,
    PageUpdate,
    PublicPageOut,
    SlugChangeIn,
    SlugCheckOut,
)
from app.integrations.registry import Integrations, get_integrations

router = APIRouter(prefix="/page", tags=["pages"])
public_router = APIRouter(prefix="/public/pages", tags=["public"])
public_domains_router = APIRouter(prefix="/public/domains", tags=["public"])

ClaimsDep = Annotated[AccessClaims, Depends(get_claims)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


@router.get("", response_model=PageOut, operation_id="getMyPage")
async def get_page(claims: ClaimsDep, session: TenantSession, settings: SettingsDep) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.patch("", response_model=PageOut, operation_id="updateMyPage")
async def update_page(
    data: PageUpdate, claims: ClaimsDep, session: TenantSession, settings: SettingsDep
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    await service.update(session, page, profile, data)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.post("/photo", response_model=PageOut, operation_id="uploadPagePhoto")
async def upload_photo(
    *,
    claims: ClaimsDep,
    session: TenantSession,
    settings: SettingsDep,
    integrations: Annotated[Integrations, Depends(get_integrations)],
    photo: Annotated[UploadFile, File()],
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    content, ext = await _read_upload(photo, IMAGE_TYPES)
    key = f"brokers/{claims.workspace_id}/{profile.id}/{uuid.uuid4()}.{ext}"
    stored = await integrations.storage.put(key, content, photo.content_type or "")
    profile.photo_url = stored.url
    await session.flush()
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.post("/publish", response_model=PageOut, operation_id="publishMyPage")
async def publish_page(claims: ClaimsDep, session: TenantSession, settings: SettingsDep) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    await service.publish(session, page, profile)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.post("/unpublish", response_model=PageOut, operation_id="unpublishMyPage")
async def unpublish_page(
    claims: ClaimsDep, session: TenantSession, settings: SettingsDep
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    await service.unpublish(session, page)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.get("/collections", response_model=PageCollectionsOut, operation_id="getPageCollections")
async def get_collections(claims: ClaimsDep, session: TenantSession) -> PageCollectionsOut:
    page, _ = await service.get_or_create(session, claims.user_id)
    out = await collections.read(session, page)
    await session.commit()
    return out


@router.put(
    "/collections", response_model=PageCollectionsOut, operation_id="replacePageCollections"
)
async def replace_collections(
    data: PageCollectionsIn, claims: ClaimsDep, session: TenantSession
) -> PageCollectionsOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    out = await collections.replace(session, page, profile, data)
    await session.commit()
    return out


@router.get("/slug-check", response_model=SlugCheckOut, operation_id="checkPageSlug")
async def check_slug(
    claims: ClaimsDep,
    session: TenantSession,
    settings: SettingsDep,
    slug: Annotated[str, Query(min_length=1, max_length=63)],
) -> SlugCheckOut:
    _, profile = await service.get_or_create(session, claims.user_id)
    wanted = slug.strip().lower()
    problem = await service.slug_problem(session, profile, wanted)
    await session.commit()
    return SlugCheckOut(slug=wanted, url=service.page_url(settings, wanted), problem=problem)


@router.put("/slug", response_model=PageOut, operation_id="changePageSlug")
async def change_slug(
    data: SlugChangeIn, claims: ClaimsDep, session: TenantSession, settings: SettingsDep
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    await service.change_slug(session, profile, data.slug)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


class DomainIn(BaseModel):
    hostname: str = Field(min_length=3, max_length=300)


@router.post("/domain", response_model=PageOut, operation_id="connectPageDomain")
async def connect_domain(
    data: DomainIn, claims: ClaimsDep, session: TenantSession, settings: SettingsDep
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    await domains.connect(session, page, data.hostname, settings)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.post("/domain/check", response_model=PageOut, operation_id="checkPageDomain")
async def check_domain(
    claims: ClaimsDep,
    session: TenantSession,
    settings: SettingsDep,
    integrations: Annotated[Integrations, Depends(get_integrations)],
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    domain = await domains.live_for_page(session, page)
    if domain is None:
        raise AppError("domain_not_found", status_code=404)
    await domains.check(
        session, domain, integrations.domains, settings, email_port=integrations.email
    )
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.delete("/domain", response_model=PageOut, operation_id="detachPageDomain")
async def detach_domain(
    claims: ClaimsDep,
    session: TenantSession,
    settings: SettingsDep,
    integrations: Annotated[Integrations, Depends(get_integrations)],
) -> PageOut:
    page, profile = await service.get_or_create(session, claims.user_id)
    await domains.detach(session, page, integrations.domains)
    out = await service.to_out(session, page, profile, settings)
    await session.commit()
    return out


@router.get("/stats", response_model=PageStatsOut, operation_id="getMyPageStats")
async def page_stats(
    claims: ClaimsDep,
    session: TenantSession,
    days: Annotated[int, Query(ge=1, le=90)] = 30,
) -> PageStatsOut:
    page, _ = await service.get_or_create(session, claims.user_id)
    out = await service.stats(session, page, days)
    await session.commit()
    return out


@router.get(
    "/qr.{kind}",
    operation_id="downloadMyPageQr",
    response_class=Response,
    responses={200: {"content": {"image/png": {}, "application/pdf": {}}}},
)
async def page_qr(
    kind: Literal["png", "pdf"],
    claims: ClaimsDep,
    session: TenantSession,
    settings: SettingsDep,
) -> Response:
    page, profile = await service.get_or_create(session, claims.user_id)
    url = await service.canonical_url(session, page, profile, settings)
    await session.commit()
    content = service.qr_code(url, kind)
    filename = f"qr-{profile.slug}.{kind}"
    return Response(
        content,
        media_type="application/pdf" if kind == "pdf" else "image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@public_router.get("/{slug}", response_model=PublicPageOut, operation_id="getPublicPage")
async def public_page(
    slug: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: SettingsDep,
) -> PublicPageOut:
    return await service.public_page(session, slug, settings)


@public_router.post(
    "/{slug}/events", status_code=status.HTTP_204_NO_CONTENT, operation_id="recordPageEvent"
)
async def record_event(  # noqa: PLR0917 - FastAPI dependencies
    slug: str,
    data: PageEventIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: SettingsDep,
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> Response:
    client = client_key(request)
    if not limiter.hit(f"page-events:{client}", settings.page_events_rate_limit_per_minute, 60):
        raise AppError("rate_limited", status_code=429)
    await service.record_event(
        session,
        slug,
        data,
        client=client,
        user_agent=request.headers.get("user-agent", ""),
        settings=settings,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@public_router.post(
    "/{slug}/inquiries",
    response_model=PageInquiryAccepted,
    status_code=status.HTTP_201_CREATED,
    operation_id="submitPageInquiry",
)
async def submit_inquiry(  # noqa: PLR0917 - FastAPI dependencies
    slug: str,
    data: PageInquiryIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: SettingsDep,
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> PageInquiryAccepted:
    client = client_key(request)
    limit = settings.page_inquiries_rate_limit_per_hour
    if not limiter.hit(f"page-inquiries:{client}", limit, 3600):
        raise AppError("rate_limited", status_code=429)
    out = await inquiries.submit(
        session,
        slug,
        data,
        client=client,
        user_agent=request.headers.get("user-agent", ""),
        settings=settings,
    )
    await session.commit()
    return out


@public_router.post(
    "/{slug}/reports", status_code=status.HTTP_204_NO_CONTENT, operation_id="reportPage"
)
async def report_page(  # noqa: PLR0917 - FastAPI dependencies
    slug: str,
    data: PageReportIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: SettingsDep,
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> Response:
    client = client_key(request)
    limit = settings.page_inquiries_rate_limit_per_hour
    if not limiter.hit(f"page-reports:{client}", limit, 3600):
        raise AppError("rate_limited", status_code=429)
    await service.report(session, slug, data, settings)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class DomainResolveOut(BaseModel):
    slug: str


@public_domains_router.get(
    "/{hostname}", response_model=DomainResolveOut, operation_id="resolvePageDomain"
)
async def resolve_domain(
    hostname: str, session: Annotated[AsyncSession, Depends(get_session)]
) -> DomainResolveOut:
    """For the web proxy: which page a custom hostname serves (404 when none is active)."""
    slug = await domains.resolve(session, hostname)
    if slug is None:
        raise AppError("not_found", status_code=404)
    return DomainResolveOut(slug=slug)
