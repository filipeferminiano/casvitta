"""Catalog (public), plan usage and change requests (broker), and their staff queue. Thin."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_claims, get_settings_dep, get_tenant_session
from app.api.v1.staff_deps import SessionDep, require_permission
from app.core.catalog import CatalogOut, catalog_out
from app.core.errors import AppError
from app.core.security import AccessClaims
from app.core.settings import Settings
from app.domains.billing import payments, service
from app.domains.billing.payments import CheckoutIn, CheckoutOut, PortalOut
from app.domains.billing.schemas import (
    ChangeRequestIn,
    ChangeRequestOut,
    DeclineIn,
    PlanUsageOut,
    StaffChangeRequestOut,
)
from app.domains.staff.audit import Actor
from app.domains.staff.permissions import Permission
from app.integrations.payments.port import InvalidSignature
from app.integrations.registry import Integrations, get_integrations

public_router = APIRouter(prefix="/public", tags=["public"])
router = APIRouter(prefix="/me/plan", tags=["me"])
staff_router = APIRouter(prefix="/staff/plan-requests", tags=["staff"])
webhooks_router = APIRouter(prefix="/webhooks", tags=["webhooks"], include_in_schema=False)

ClaimsDep = Annotated[AccessClaims, Depends(get_claims)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
IntegrationsDep = Annotated[Integrations, Depends(get_integrations)]
BillingActor = Annotated[Actor, Depends(require_permission(Permission.MANAGE_BILLING))]


@public_router.get("/catalog", response_model=CatalogOut, operation_id="getCatalog")
async def get_catalog(settings: SettingsDep) -> CatalogOut:
    return catalog_out(show_annual_prices=settings.show_annual_prices)


@router.get("", response_model=PlanUsageOut, operation_id="getPlanUsage")
async def get_usage(
    claims: ClaimsDep, session: TenantSession, settings: SettingsDep
) -> PlanUsageOut:
    on = await payments.billing_on(session, settings, claims.user_id)
    return await service.usage(session, billing_enabled=on)


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
async def downgrade(
    claims: ClaimsDep, session: TenantSession, settings: SettingsDep, integrations: IntegrationsDep
) -> PlanUsageOut:
    """Back to Grátis: at the end of the paid period when paying through Stripe, else now."""
    if not await payments.cancel_at_period_end(session, integrations.payments):
        await service.downgrade_to_free(session)
    on = await payments.billing_on(session, settings, claims.user_id)
    out = await service.usage(session, billing_enabled=on)
    await session.commit()
    return out


@router.post("/checkout", response_model=CheckoutOut, operation_id="startPlanCheckout")
async def checkout(
    data: CheckoutIn,
    claims: ClaimsDep,
    session: TenantSession,
    settings: SettingsDep,
    integrations: IntegrationsDep,
) -> CheckoutOut:
    out = await payments.start_checkout(
        session, integrations.payments, settings, claims.user_id, data
    )
    await session.commit()
    return out


@router.post("/resume", response_model=PlanUsageOut, operation_id="resumePlan")
async def resume(
    claims: ClaimsDep, session: TenantSession, settings: SettingsDep, integrations: IntegrationsDep
) -> PlanUsageOut:
    """Undo "voltar para o Grátis" before the paid period ends."""
    await payments.resume(session, integrations.payments)
    on = await payments.billing_on(session, settings, claims.user_id)
    out = await service.usage(session, billing_enabled=on)
    await session.commit()
    return out


@router.post("/portal", response_model=PortalOut, operation_id="openBillingPortal")
async def billing_portal(
    claims: ClaimsDep, session: TenantSession, settings: SettingsDep, integrations: IntegrationsDep
) -> PortalOut:
    return await payments.portal(session, integrations.payments, settings, claims.user_id)


@webhooks_router.post("/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    integrations: IntegrationsDep,
    stripe_signature: Annotated[str, Header(alias="Stripe-Signature")] = "",
) -> dict[str, str]:
    """Stripe events (signed). Any 2xx tells Stripe not to retry."""
    payload = await request.body()
    try:
        event = integrations.payments.parse_event(payload, stripe_signature)
    except InvalidSignature as exc:
        raise AppError("invalid_signature", status_code=400) from exc
    outcome = await payments.handle_event(
        session,
        event,
        integrations.payments,
        email_port=integrations.email,
        settings=settings,
    )
    await session.commit()
    return {"outcome": outcome}


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
