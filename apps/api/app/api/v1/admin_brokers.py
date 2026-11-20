"""Staff tools for broker accounts (admin token until staff accounts exist). Audited."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_admin
from app.core.db import get_session
from app.domains.accounts import service
from app.domains.accounts.schemas import AdminBrokerOut, BrokerProfileOut, CreciStatus

router = APIRouter(prefix="/admin/brokers", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AdminBrokerOut], operation_id="listBrokersForStaff")
async def list_brokers(
    session: Annotated[AsyncSession, Depends(get_session)],
    creci_status: Annotated[CreciStatus | None, Query()] = None,
) -> list[AdminBrokerOut]:
    result = await service.list_brokers_for_staff(session, creci_status)
    await session.commit()
    return result


@router.post(
    "/{profile_id}/creci/verify", response_model=BrokerProfileOut, operation_id="verifyBrokerCreci"
)
async def verify_creci(
    profile_id: uuid.UUID, session: Annotated[AsyncSession, Depends(get_session)]
) -> BrokerProfileOut:
    result = await service.verify_creci(session, profile_id)
    await session.commit()
    return result
