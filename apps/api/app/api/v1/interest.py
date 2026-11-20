from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import client_key, get_rate_limiter, get_settings_dep, require_admin
from app.core.db import get_session
from app.core.rate_limit import RateLimiter
from app.core.settings import Settings
from app.domains.interest import service
from app.domains.interest.models import InterestKind
from app.domains.interest.schemas import InterestSignupAccepted, InterestSignupIn, InterestSignupOut
from app.integrations.registry import Integrations, get_integrations

public_router = APIRouter(prefix="/public", tags=["public"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@public_router.post(
    "/interest",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=InterestSignupAccepted,
    operation_id="createInterestSignup",
)
async def create_interest(  # noqa: PLR0917 - FastAPI dependencies
    payload: InterestSignupIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    integrations: Annotated[Integrations, Depends(get_integrations)],
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> InterestSignupAccepted:
    """Capture pages: store the signup and ask for WhatsApp double opt-in. No auth."""
    opt_in = await service.create_signup(
        session,
        payload,
        whatsapp=integrations.whatsapp,
        limiter=limiter,
        client_key=client_key(request),
        limit_per_minute=settings.interest_rate_limit_per_minute,
    )
    await session.commit()
    return InterestSignupAccepted(opt_in=opt_in)


@admin_router.get(
    "/interest",
    response_model=list[InterestSignupOut],
    operation_id="listInterestSignups",
    dependencies=[Depends(require_admin)],
    responses={200: {"content": {"text/csv": {}}}},
)
async def list_interest(
    session: Annotated[AsyncSession, Depends(get_session)],
    kind: Annotated[InterestKind | None, Query()] = None,
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
) -> list[InterestSignupOut] | PlainTextResponse:
    rows = await service.list_signups(session, kind)
    if format == "csv":
        return PlainTextResponse(
            service.to_csv(rows),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="interest_signups.csv"'},
        )
    return [InterestSignupOut.model_validate(r) for r in rows]
