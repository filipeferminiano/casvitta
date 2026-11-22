"""Backoffice operations: overview (BO1), search, CRECI (BO2), captures (BO3). Thin."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel

from app.api.v1.deps import client_key, get_rate_limiter
from app.api.v1.staff_deps import (
    ActorDep,
    SessionDep,
    SettingsDep,
    require_permission,
    require_recent_auth,
)
from app.core.errors import AppError
from app.core.rate_limit import RateLimited, RateLimiter
from app.core.time import utcnow
from app.domains.backoffice import (
    accounts,
    authorizations,
    captures,
    creci,
    moderation,
    revenue,
    service,
)
from app.domains.backoffice.schemas import OverviewOut, SearchOut
from app.domains.interest.models import InterestKind
from app.domains.staff.audit import Actor
from app.domains.staff.permissions import Permission
from app.integrations.registry import Integrations, get_integrations

IntegrationsDep = Annotated[Integrations, Depends(get_integrations)]

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("/overview", response_model=OverviewOut, operation_id="getStaffOverview")
async def overview(actor: ActorDep, session: SessionDep, settings: SettingsDep) -> OverviewOut:
    """Every role reads it; the team activity needs the audit permission."""
    return await service.overview(session, actor, settings)


@router.get("/search", response_model=SearchOut, operation_id="staffSearch")
async def search(
    actor: ActorDep,
    session: SessionDep,
    q: Annotated[str, Query(min_length=2, max_length=120)],
) -> SearchOut:
    result = await service.search(session, actor, q)
    await session.commit()  # the search term is audited
    return result


# ------------------------------------------------------------------ CRECI (BO2)


@router.get("/creci", response_model=creci.CreciQueueOut, operation_id="listCreciQueue")
async def creci_queue(
    actor: ActorDep,
    session: SessionDep,
    settings: SettingsDep,
    status: creci.Tab = "pending",
) -> creci.CreciQueueOut:
    result = await creci.queue(session, actor, status, settings)
    await session.commit()
    return result


VerifyCreci = Annotated[Actor, Depends(require_permission(Permission.VERIFY_CRECI))]


@router.post(
    "/creci/{profile_id}/approve", response_model=creci.CreciItem, operation_id="approveCreci"
)
async def approve_creci(  # noqa: PLR0917
    profile_id: uuid.UUID,
    payload: creci.CreciApproveIn,
    actor: VerifyCreci,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
) -> creci.CreciItem:
    result = await creci.approve(
        session,
        actor,
        profile_id,
        payload.checklist,
        email_port=integrations.email,
        settings=settings,
    )
    await session.commit()
    return result


@router.post(
    "/creci/{profile_id}/request-correction",
    response_model=creci.CreciItem,
    operation_id="requestCreciCorrection",
)
async def request_creci_correction(  # noqa: PLR0917
    profile_id: uuid.UUID,
    payload: creci.ReasonIn,
    actor: VerifyCreci,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
) -> creci.CreciItem:
    result = await creci.decide(
        session,
        actor,
        profile_id,
        "correction_requested",
        payload.reason,
        email_port=integrations.email,
        settings=settings,
    )
    await session.commit()
    return result


@router.post(
    "/creci/{profile_id}/reject", response_model=creci.CreciItem, operation_id="rejectCreci"
)
async def reject_creci(  # noqa: PLR0917
    profile_id: uuid.UUID,
    payload: creci.ReasonIn,
    actor: VerifyCreci,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
) -> creci.CreciItem:
    result = await creci.decide(
        session,
        actor,
        profile_id,
        "rejected",
        payload.reason,
        email_port=integrations.email,
        settings=settings,
    )
    await session.commit()
    return result


# ------------------------------------------------------------------ captures (BO3)

HandleCaptures = Annotated[Actor, Depends(require_permission(Permission.HANDLE_CAPTURES))]


@router.get("/captures", response_model=captures.CaptureListOut, operation_id="listCaptures")
async def list_captures(  # noqa: PLR0917
    actor: ActorDep,
    session: SessionDep,
    kind: InterestKind,
    state: captures.StateFilter = "all",
    opt_in: captures.OptInFilter = "all",
    region: Annotated[str | None, Query(max_length=80)] = None,
    origin: Annotated[str | None, Query(max_length=80)] = None,
) -> captures.CaptureListOut:
    result = await captures.list_captures(
        session, actor, kind, state=state, opt_in=opt_in, region=region, origin=origin
    )
    await session.commit()
    return result


@router.get(
    "/captures/export",
    operation_id="exportCaptures",
    response_class=PlainTextResponse,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_captures(
    actor: Annotated[Actor, Depends(require_permission(Permission.EXPORT_CONTACTS))],
    session: SessionDep,
    kind: InterestKind,
    region: Annotated[str | None, Query(max_length=80)] = None,
    origin: Annotated[str | None, Query(max_length=80)] = None,
) -> PlainTextResponse:
    body = await captures.export_csv(session, actor, kind, region=region, origin=origin)
    await session.commit()
    return PlainTextResponse(
        body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="captacoes-{kind.value}.csv"'},
    )


@router.get("/captures/{signup_id}", response_model=captures.CaptureItem, operation_id="getCapture")
async def get_capture(
    signup_id: uuid.UUID, actor: ActorDep, session: SessionDep
) -> captures.CaptureItem:
    result = await captures.get_capture(session, actor, signup_id)
    await session.commit()
    return result


@router.post(
    "/captures/{signup_id}/reveal",
    response_model=captures.RevealOut,
    operation_id="revealCaptureContact",
)
async def reveal_capture_contact(
    signup_id: uuid.UUID,
    payload: captures.RevealIn,
    actor: Annotated[Actor, Depends(require_permission(Permission.REVEAL_CONTACTS))],
    session: SessionDep,
) -> captures.RevealOut:
    result = await captures.reveal(session, actor, signup_id, payload)
    await session.commit()
    return result


@router.get(
    "/captures/{signup_id}/candidates",
    response_model=list[captures.BrokerCandidate],
    operation_id="listCaptureCandidates",
)
async def capture_candidates(
    signup_id: uuid.UUID, _actor: HandleCaptures, session: SessionDep
) -> list[captures.BrokerCandidate]:
    return await captures.candidates(session, signup_id)


@router.post(
    "/captures/{signup_id}/assign",
    response_model=captures.CaptureItem,
    operation_id="assignCapture",
)
async def assign_capture(  # noqa: PLR0917
    signup_id: uuid.UUID,
    payload: captures.AssignIn,
    actor: HandleCaptures,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
) -> captures.CaptureItem:
    result = await captures.assign(
        session,
        actor,
        signup_id,
        payload.broker_profile_id,
        email_port=integrations.email,
        settings=settings,
    )
    await session.commit()
    return result


class HandledIn(BaseModel):
    handled: bool


@router.post(
    "/captures/{signup_id}/handled",
    response_model=captures.CaptureItem,
    operation_id="markCaptureHandled",
)
async def mark_capture_handled(
    signup_id: uuid.UUID, payload: HandledIn, actor: HandleCaptures, session: SessionDep
) -> captures.CaptureItem:
    result = await captures.mark_handled(session, actor, signup_id, payload.handled)
    await session.commit()
    return result


@router.get(
    "/property-alerts/groups",
    response_model=list[captures.AlertGroup],
    operation_id="listAlertGroups",
)
async def alert_groups(actor: ActorDep, session: SessionDep) -> list[captures.AlertGroup]:
    result = await captures.alert_groups(session, actor)
    await session.commit()
    return result


# ------------------------------------------------------------------ broker accepts a referral

public_router = APIRouter(prefix="/public", tags=["public"])


class AcceptOut(BaseModel):
    status: Literal["accepted", "expired"]


@public_router.post(
    "/capture-assignments/accept", response_model=AcceptOut, operation_id="acceptCapture"
)
async def accept_capture(  # noqa: PLR0917
    payload: captures.AcceptIn,
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> AcceptOut:
    """The emailed "Aceitar pedido" link: the token is the proof (no session needed)."""
    if not limiter.hit(f"accept:{client_key(request)}", settings.auth_rate_limit_per_minute, 60):
        raise RateLimited
    status = await captures.accept(session, payload.token, email_port=integrations.email)
    await session.commit()
    return AcceptOut(status=status)


# ------------------------------------------------------------------ accounts (BO4, BO5)


@router.get("/accounts", response_model=accounts.AccountListOut, operation_id="listAccounts")
async def list_accounts(
    actor: ActorDep, session: SessionDep, view: accounts.AccountFilter = "all"
) -> accounts.AccountListOut:
    result = await accounts.list_accounts(session, actor, view)
    await session.commit()
    return result


@router.get(
    "/accounts/{workspace_id}", response_model=accounts.Account360, operation_id="getAccount"
)
async def get_account(
    workspace_id: uuid.UUID, actor: ActorDep, session: SessionDep
) -> accounts.Account360:
    result = await accounts.account_360(session, actor, workspace_id)
    await session.commit()
    return result


ModerateDep = Annotated[Actor, Depends(require_permission(Permission.MODERATE_LISTINGS))]


@router.post(
    "/accounts/{workspace_id}/pause-publishing",
    status_code=204,
    operation_id="pauseAccountPublishing",
    dependencies=[Depends(require_recent_auth)],
)
async def pause_publishing(
    workspace_id: uuid.UUID, payload: accounts.ReasonIn, actor: ModerateDep, session: SessionDep
) -> None:
    await accounts.set_publishing_paused(session, actor, workspace_id, payload.reason, paused=True)
    await session.commit()


@router.post(
    "/accounts/{workspace_id}/resume-publishing",
    status_code=204,
    operation_id="resumeAccountPublishing",
)
async def resume_publishing(
    workspace_id: uuid.UUID, payload: accounts.ReasonIn, actor: ModerateDep, session: SessionDep
) -> None:
    await accounts.set_publishing_paused(session, actor, workspace_id, payload.reason, paused=False)
    await session.commit()


@router.post(
    "/accounts/{workspace_id}/notes",
    response_model=accounts.Note,
    status_code=201,
    operation_id="addAccountNote",
)
async def add_account_note(
    workspace_id: uuid.UUID, payload: accounts.NoteIn, actor: ActorDep, session: SessionDep
) -> accounts.Note:
    if not actor.permissions:  # Leitura reads only
        raise AppError("forbidden", status_code=403)
    result = await accounts.add_note(session, actor, workspace_id, payload.body)
    await session.commit()
    return result


@router.post(
    "/accounts/{workspace_id}/view-as",
    response_model=accounts.ViewAsOut,
    operation_id="viewAccountAsCustomer",
)
async def view_account_as_customer(
    workspace_id: uuid.UUID,
    payload: accounts.ReasonIn,
    actor: Annotated[Actor, Depends(require_permission(Permission.VIEW_AS_CUSTOMER))],
    session: SessionDep,
    settings: SettingsDep,
) -> accounts.ViewAsOut:
    result = await accounts.view_as(session, actor, workspace_id, payload.reason, settings=settings)
    await session.commit()
    return result


# ------------------------------------------------------------------ moderation (BO6)


@router.get(
    "/moderation",
    response_model=moderation.ModerationQueueOut,
    operation_id="getModerationQueue",
)
async def moderation_queue(
    _actor: ActorDep, settings: SettingsDep
) -> moderation.ModerationQueueOut:
    """Off ("liga depois") until listings exist; then only exceptions and reports."""
    return await moderation.queue(moderation.NoListingsYet(), settings, utcnow().date())


# ------------------------------------------------------------------ revenue (BO7)


@router.get("/revenue", response_model=revenue.RevenueOut, operation_id="getRevenue")
async def get_revenue(
    _actor: Annotated[Actor, Depends(require_permission(Permission.MANAGE_BILLING))],
    settings: SettingsDep,
) -> revenue.RevenueOut:
    """Lines from the offer catalog; amounts arrive with billing."""
    return revenue.revenue(settings)


# ------------------------------------------------------------------ owner authorizations (BO6)

AuthorizationsActor = Annotated[Actor, Depends(require_permission(Permission.MODERATE_LISTINGS))]


@router.get(
    "/authorizations",
    response_model=list[authorizations.AuthorizationItem],
    operation_id="listAuthorizationQueue",
)
async def authorization_queue(
    _actor: AuthorizationsActor, session: SessionDep
) -> list[authorizations.AuthorizationItem]:
    return await authorizations.queue(session)


@router.post(
    "/authorizations/{authorization_id}/verify",
    status_code=204,
    operation_id="verifyAuthorization",
)
async def verify_authorization(
    authorization_id: uuid.UUID, actor: AuthorizationsActor, session: SessionDep
) -> None:
    await authorizations.verify(session, actor, authorization_id)
    await session.commit()


@router.post(
    "/authorizations/{authorization_id}/reject",
    status_code=204,
    operation_id="rejectAuthorization",
)
async def reject_authorization(
    authorization_id: uuid.UUID,
    data: authorizations.RejectIn,
    actor: AuthorizationsActor,
    session: SessionDep,
) -> None:
    await authorizations.reject(session, actor, authorization_id, data.reason)
    await session.commit()


@router.get(
    "/authorizations/{authorization_id}/document",
    operation_id="getAuthorizationDocument",
    response_class=Response,
)
async def authorization_document(
    authorization_id: uuid.UUID,
    actor: AuthorizationsActor,
    session: SessionDep,
    integrations: IntegrationsDep,
) -> Response:
    key = await authorizations.document_key(session, actor, authorization_id)
    await session.commit()
    data = await integrations.storage.get(key)
    media = "application/pdf" if key.endswith(".pdf") else f"image/{key.rsplit('.', 1)[-1]}"
    return Response(
        data,
        media_type=media,
        headers={"Cache-Control": "no-store", "Content-Disposition": "inline"},
    )
