"""Backoffice reads: overview (BO1) and global search. Thin: logic in the service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.v1.staff_deps import ActorDep, SessionDep, SettingsDep
from app.domains.backoffice import service
from app.domains.backoffice.schemas import OverviewOut, SearchOut

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
