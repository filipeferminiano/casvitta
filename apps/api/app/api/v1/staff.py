"""Backoffice: staff sign-in, re-auth, who am I, team and audit log. Thin: logic in the service."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import PlainTextResponse

from app.api.v1.deps import client_key, get_rate_limiter
from app.api.v1.staff_deps import (
    STAFF_REFRESH_COOKIE,
    ActorDep,
    SessionDep,
    SettingsDep,
    clear_staff_cookies,
    get_staff_claims,
    require_admin_token,
    require_permission,
    set_staff_access_cookie,
    set_staff_cookies,
)
from app.core.rate_limit import RateLimiter
from app.core.security import StaffClaims
from app.core.time import utcnow
from app.domains.staff import service
from app.domains.staff.audit import Actor
from app.domains.staff.models import StaffUser
from app.domains.staff.permissions import Permission
from app.domains.staff.schemas import (
    AuditPage,
    ReauthCodeIn,
    StaffBootstrapIn,
    StaffEmailLinkIn,
    StaffInviteIn,
    StaffMemberOut,
    StaffMeOut,
    StaffTokenIn,
    StaffUpdateIn,
)
from app.domains.staff.service import AuditFilters, StaffSessionExpired
from app.integrations.registry import Integrations, get_integrations

router = APIRouter(prefix="/staff", tags=["staff"])

IntegrationsDep = Annotated[Integrations, Depends(get_integrations)]
LimiterDep = Annotated[RateLimiter, Depends(get_rate_limiter)]

# ------------------------------------------------------------------ sign-in


@router.post(
    "/auth/email-link", status_code=status.HTTP_202_ACCEPTED, operation_id="requestStaffLink"
)
async def request_link(  # noqa: PLR0917 - FastAPI dependencies
    payload: StaffEmailLinkIn,
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
    limiter: LimiterDep,
) -> dict[str, str]:
    """Same answer for every address: only allowlisted, active staff actually get a link."""
    await service.request_link(
        session,
        payload.email,
        email_port=integrations.email,
        settings=settings,
        limiter=limiter,
        client_key=client_key(request),
    )
    await session.commit()
    return {"status": "sent"}


@router.post(
    "/auth/confirm", status_code=status.HTTP_204_NO_CONTENT, operation_id="confirmStaffLink"
)
async def confirm_link(
    payload: StaffTokenIn,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> None:
    issued = await service.confirm_link(
        session, payload.token, settings=settings, user_agent=request.headers.get("user-agent")
    )
    await session.commit()
    set_staff_cookies(response, issued, settings)


@router.post("/auth/refresh", status_code=status.HTTP_204_NO_CONTENT, operation_id="refreshStaff")
async def refresh(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> None:
    token = request.cookies.get(STAFF_REFRESH_COOKIE)
    if not token:
        raise StaffSessionExpired
    try:
        issued = await service.refresh(
            session, token, settings=settings, user_agent=request.headers.get("user-agent")
        )
    finally:
        await session.commit()  # keeps a revocation when a reused token is detected
    set_staff_cookies(response, issued, settings)


@router.post("/auth/sign-out", status_code=status.HTTP_204_NO_CONTENT, operation_id="signOutStaff")
async def sign_out(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> None:
    await service.sign_out(session, request.cookies.get(STAFF_REFRESH_COOKIE))
    await session.commit()
    clear_staff_cookies(response, settings)


@router.post(
    "/auth/reauth/request",
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="requestStaffReauthCode",
)
async def request_reauth(
    actor: ActorDep,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
    limiter: LimiterDep,
) -> dict[str, str]:
    staff = await _staff_of(session, actor)
    await service.request_reauth_code(
        session, staff, email_port=integrations.email, settings=settings, limiter=limiter
    )
    await session.commit()
    return {"status": "sent"}


@router.post("/auth/reauth/confirm", response_model=StaffMeOut, operation_id="confirmStaffReauth")
async def confirm_reauth(  # noqa: PLR0917
    payload: ReauthCodeIn,
    response: Response,
    actor: ActorDep,
    claims: Annotated[StaffClaims, Depends(get_staff_claims)],
    session: SessionDep,
    settings: SettingsDep,
) -> StaffMeOut:
    staff = await _staff_of(session, actor)
    try:
        token = await service.confirm_reauth_code(
            session, staff, claims.family_id, payload.code, settings=settings
        )
    finally:
        await session.commit()  # counts a wrong attempt
    set_staff_access_cookie(response, token, settings)
    renewed = service.actor_for(staff, utcnow())
    return service.me_out(staff, renewed, settings)


async def _staff_of(session: SessionDep, actor: Actor) -> StaffUser:
    if actor.staff_id is None:
        raise StaffSessionExpired
    return await service.load_active_staff(session, actor.staff_id)


# ------------------------------------------------------------------ me and team


@router.get("/me", response_model=StaffMeOut, operation_id="getStaffMe")
async def me(actor: ActorDep, session: SessionDep, settings: SettingsDep) -> StaffMeOut:
    staff = await _staff_of(session, actor)
    return service.me_out(staff, actor, settings)


@router.get("/team", response_model=list[StaffMemberOut], operation_id="listStaff")
async def list_team(_actor: ActorDep, session: SessionDep) -> list[StaffMemberOut]:
    return await service.list_team(session)


@router.post(
    "/team",
    response_model=StaffMemberOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="inviteStaff",
)
async def invite(
    payload: StaffInviteIn,
    actor: Annotated[Actor, Depends(require_permission(Permission.MANAGE_STAFF))],
    session: SessionDep,
) -> StaffMemberOut:
    result = await service.invite(session, actor, payload)
    await session.commit()
    return result


@router.patch("/team/{staff_id}", response_model=StaffMemberOut, operation_id="updateStaff")
async def update_member(
    staff_id: uuid.UUID,
    payload: StaffUpdateIn,
    actor: Annotated[Actor, Depends(require_permission(Permission.MANAGE_STAFF))],
    session: SessionDep,
) -> StaffMemberOut:
    result = await service.update_member(session, actor, staff_id, payload)
    await session.commit()
    return result


@router.post(
    "/bootstrap",
    response_model=StaffMemberOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="bootstrapStaffAdmin",
)
async def bootstrap(
    payload: StaffBootstrapIn,
    actor: Annotated[Actor, Depends(require_admin_token)],
    session: SessionDep,
) -> StaffMemberOut:
    """Script only (admin token): creates the first Admin. Refused once one exists."""
    result = await service.bootstrap_admin(session, actor, payload.email, payload.name)
    await session.commit()
    return result


# ------------------------------------------------------------------ audit log


def _filters(
    staff_id: uuid.UUID | None,
    actor: str | None,
    action: str | None,
    since: datetime | None,
    until: datetime | None,
) -> AuditFilters:
    return AuditFilters(
        actor_staff_id=staff_id, actor=actor, action=action, since=since, until=until
    )


@router.get("/audit", response_model=AuditPage, operation_id="listAudit")
async def list_audit(  # noqa: PLR0917
    _actor: Annotated[Actor, Depends(require_permission(Permission.VIEW_AUDIT))],
    session: SessionDep,
    staff_id: Annotated[uuid.UUID | None, Query()] = None,
    actor: Annotated[str | None, Query(pattern=r"^system(:admin-token)?$")] = None,
    action: Annotated[str | None, Query(max_length=80)] = None,
    since: Annotated[datetime | None, Query()] = None,
    until: Annotated[datetime | None, Query()] = None,
    before: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AuditPage:
    return await service.list_audit(
        session, _filters(staff_id, actor, action, since, until), before=before, limit=limit
    )


@router.get(
    "/audit/export",
    operation_id="exportAudit",
    response_class=PlainTextResponse,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_audit(  # noqa: PLR0917
    actor_: Annotated[Actor, Depends(require_permission(Permission.EXPORT_AUDIT))],
    session: SessionDep,
    staff_id: Annotated[uuid.UUID | None, Query()] = None,
    actor: Annotated[str | None, Query(pattern=r"^system(:admin-token)?$")] = None,
    action: Annotated[str | None, Query(max_length=80)] = None,
    since: Annotated[datetime | None, Query()] = None,
    until: Annotated[datetime | None, Query()] = None,
) -> PlainTextResponse:
    body = await service.export_audit_csv(
        session, actor_, _filters(staff_id, actor, action, since, until)
    )
    await session.commit()
    return PlainTextResponse(
        body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="auditoria.csv"'},
    )
