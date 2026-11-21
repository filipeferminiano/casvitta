"""Broker CRECI review for scripts (the backoffice uses /staff/creci). Audited."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.staff_deps import ActorDep, require_permission
from app.core.db import get_session
from app.domains.accounts import service
from app.domains.accounts.schemas import AdminBrokerOut, BrokerProfileOut, CreciStatus
from app.domains.staff.audit import Actor
from app.domains.staff.permissions import Permission

router = APIRouter(prefix="/admin/brokers", tags=["admin"])


@router.get("", response_model=list[AdminBrokerOut], operation_id="listBrokersForStaff")
async def list_brokers(
    actor: ActorDep,
    session: Annotated[AsyncSession, Depends(get_session)],
    creci_status: Annotated[CreciStatus | None, Query()] = None,
) -> list[AdminBrokerOut]:
    result = await service.list_brokers_for_staff(session, creci_status, actor)
    await session.commit()
    return result


@router.post(
    "/{profile_id}/creci/verify", response_model=BrokerProfileOut, operation_id="verifyBrokerCreci"
)
async def verify_creci(
    profile_id: uuid.UUID,
    actor: Annotated[Actor, Depends(require_permission(Permission.VERIFY_CRECI))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BrokerProfileOut:
    result = await service.verify_creci(session, profile_id, actor)
    await session.commit()
    return result
