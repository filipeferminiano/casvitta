"""Sign-in by email link, session refresh, sign-out and the cross-host handoff."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import (
    REFRESH_COOKIE,
    clear_session_cookies,
    client_key,
    get_claims,
    get_rate_limiter,
    get_settings_dep,
    set_session_cookies,
)
from app.core.db import get_session
from app.core.rate_limit import RateLimiter
from app.core.security import AccessClaims
from app.core.settings import Settings
from app.domains.accounts import service
from app.domains.accounts.schemas import EmailLinkIn, EmailLinkSent, HandoffOut, SignedIn, TokenIn
from app.domains.accounts.service import SessionExpired
from app.integrations.registry import Integrations, get_integrations

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


@router.post(
    "/email-link",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EmailLinkSent,
    operation_id="requestEmailLink",
)
async def request_email_link(  # noqa: PLR0917 - FastAPI dependencies
    payload: EmailLinkIn,
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    integrations: Annotated[Integrations, Depends(get_integrations)],
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> EmailLinkSent:
    await service.request_email_link(
        session,
        payload,
        email_port=integrations.email,
        settings=settings,
        limiter=limiter,
        client_key=client_key(request),
    )
    await session.commit()
    return EmailLinkSent()


@router.post("/confirm", response_model=SignedIn, operation_id="confirmEmailLink")
async def confirm_email_link(
    payload: TokenIn,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> SignedIn:
    issued, created = await service.confirm_email_link(
        session, payload.token, settings=settings, user_agent=request.headers.get("user-agent")
    )
    await session.commit()
    set_session_cookies(response, issued, settings)
    return SignedIn(intent="sign_up" if created else "sign_in")


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT, operation_id="refreshSession")
async def refresh_session(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> None:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise SessionExpired
    try:
        issued = await service.refresh_session(
            session, token, settings=settings, user_agent=request.headers.get("user-agent")
        )
    finally:
        await session.commit()  # keeps the revocation when a reused token is detected
    set_session_cookies(response, issued, settings)


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT, operation_id="signOut")
async def sign_out(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> None:
    await service.sign_out(session, request.cookies.get(REFRESH_COOKIE))
    await session.commit()
    clear_session_cookies(response, settings)


@router.post("/handoff", response_model=HandoffOut, operation_id="createHandoff")
async def create_handoff(
    claims: Annotated[AccessClaims, Depends(get_claims)], session: SessionDep, settings: SettingsDep
) -> HandoffOut:
    code = await service.create_handoff(session, claims.user_id, settings=settings)
    await session.commit()
    return HandoffOut(code=code)


@router.post("/handoff/claim", status_code=status.HTTP_204_NO_CONTENT, operation_id="claimHandoff")
async def claim_handoff(
    payload: TokenIn,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> None:
    issued = await service.claim_handoff(
        session, payload.token, settings=settings, user_agent=request.headers.get("user-agent")
    )
    await session.commit()
    set_session_cookies(response, issued, settings)
