"""The signed-in broker: account, plan and broker profile (signup steps, Configurações)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_claims, get_tenant_session
from app.core.security import AccessClaims
from app.domains.accounts import service
from app.domains.accounts.schemas import (
    BrokerProfileOut,
    BrokerProfileUpdate,
    MeOut,
    WorkspaceOut,
    WorkspaceUpdate,
)

router = APIRouter(prefix="/me", tags=["me"])

ClaimsDep = Annotated[AccessClaims, Depends(get_claims)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


@router.get("", response_model=MeOut, operation_id="getMe")
async def get_me(claims: ClaimsDep, session: TenantSession) -> MeOut:
    return await service.get_me(session, claims.user_id, claims.acting_staff_id)


@router.patch(
    "/broker-profile", response_model=BrokerProfileOut, operation_id="updateBrokerProfile"
)
async def update_broker_profile(
    patch: BrokerProfileUpdate, claims: ClaimsDep, session: TenantSession
) -> BrokerProfileOut:
    result = await service.update_broker_profile(session, claims.user_id, patch)
    await session.commit()
    return result


@router.patch("/workspace", response_model=WorkspaceOut, operation_id="updateWorkspace")
async def update_workspace(patch: WorkspaceUpdate, session: TenantSession) -> WorkspaceOut:
    result = await service.set_plan(session, patch.plan)
    await session.commit()
    return result
