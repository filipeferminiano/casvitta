"""Catalog (public), plan usage and change requests (broker), and their staff queue. Thin."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_claims, get_settings_dep, get_tenant_session
from app.api.v1.staff_deps import SessionDep, require_permission
from app.core.catalog import CatalogOut, catalog_out
from app.core.security import AccessClaims
from app.core.settings import Settings
from app.domains.billing import service
from app.domains.billing.schemas import (
    ChangeRequestIn,
    ChangeRequestOut,
    DeclineIn,
    PlanUsageOut,
    StaffChangeRequestOut,
)
from app.domains.staff.audit import Actor
from app.domains.staff.permissions import Permission

public_router = APIRouter(prefix="/public", tags=["public"])
router = APIRouter(prefix="/me/plan", tags=["me"])
staff_router = APIRouter(prefix="/staff/plan-requests", tags=["staff"])

ClaimsDep = Annotated[AccessClaims, Depends(get_claims)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
BillingActor = Annotated[Actor, Depends(require_permission(Permission.MANAGE_BILLING))]


@public_router.get("/catalog", response_model=CatalogOut, operation_id="getCatalog")
async def get_catalog(settings: SettingsDep) -> CatalogOut:
    return catalog_out(show_annual_prices=settings.show_annual_prices)


@router.get("", response_model=PlanUsageOut, operation_id="getPlanUsage")
async def get_usage(session: TenantSession, settings: SettingsDep) -> PlanUsageOut:
    return await service.usage(session, billing_enabled=settings.billing_enabled)


@router.post(
    "/requests",
    response_model=ChangeRequestOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="requestPlanChange",
)
async def request_change(
    data: ChangeRequestIn, claims: ClaimsDep, session: TenantSession
) -> ChangeRequestOut:
    out = await service.request_change(session, claims.user_id, data)
    await session.commit()
    return out


@router.delete(
    "/requests/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="cancelPlanChange",
)
async def cancel_request(request_id: uuid.UUID, session: TenantSession) -> None:
    await service.cancel_request(session, request_id)
    await session.commit()


@router.post("/downgrade", response_model=PlanUsageOut, operation_id="downgradeToFree")
async def downgrade(session: TenantSession, settings: SettingsDep) -> PlanUsageOut:
    await service.downgrade_to_free(session)
    out = await service.usage(session, billing_enabled=settings.billing_enabled)
    await session.commit()
    return out


@staff_router.get("", response_model=list[StaffChangeRequestOut], operation_id="listPlanRequests")
async def list_requests(_actor: BillingActor, session: SessionDep) -> list[StaffChangeRequestOut]:
    return await service.staff_open_requests(session)


@staff_router.post(
    "/{request_id}/approve",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="approvePlanRequest",
)
async def approve(request_id: uuid.UUID, actor: BillingActor, session: SessionDep) -> None:
    await service.approve(session, actor, request_id)
    await session.commit()


@staff_router.post(
    "/{request_id}/decline",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="declinePlanRequest",
)
async def decline(
    request_id: uuid.UUID, data: DeclineIn, actor: BillingActor, session: SessionDep
) -> None:
    await service.decline(session, actor, request_id, data.reason)
    await session.commit()
