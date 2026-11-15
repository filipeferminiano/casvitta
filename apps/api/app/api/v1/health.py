from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.logging import get_logger

router = APIRouter(tags=["health"])
log = get_logger(__name__)


class HealthOut(BaseModel):
    status: Literal["ok"]


class ReadinessOut(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]


@router.get("/health", response_model=HealthOut, operation_id="getHealth")
async def health() -> HealthOut:
    """Liveness: the process is up."""
    return HealthOut(status="ok")


@router.get(
    "/health/ready",
    response_model=ReadinessOut,
    responses={503: {"model": ReadinessOut}},
    operation_id="getReadiness",
)
async def readiness(session: Annotated[AsyncSession, Depends(get_session)]) -> JSONResponse:
    """Readiness: dependencies answer."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        log.warning("readiness_db_failed", error=str(exc))
        body = ReadinessOut(status="degraded", database="unavailable")
        return JSONResponse(body.model_dump(), status_code=503)
    return JSONResponse(ReadinessOut(status="ok", database="ok").model_dump())
