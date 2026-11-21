"""Backoffice operations: overview (BO1), search, CRECI (BO2). Thin: logic in services."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.v1.staff_deps import ActorDep, SessionDep, SettingsDep, require_permission
from app.domains.backoffice import creci, service
from app.domains.backoffice.schemas import OverviewOut, SearchOut
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
