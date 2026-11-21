"""Shared request dependencies: settings, rate limiting, staff token and the signed-in user."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.rate_limit import RateLimiter
from app.core.security import AccessClaims, InvalidAccessToken, decode_access_token
from app.core.settings import Settings
from app.core.tenancy import bind_workspace
from app.domains.accounts.service import IssuedSession, SessionExpired

ACCESS_COOKIE = "cv_at"
REFRESH_COOKIE = "cv_rt"
# Not secret: lets the web app's proxy redirect signed-out visitors before rendering.
SESSION_HINT_COOKIE = "cv_session"


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_rate_limiter(request: Request) -> RateLimiter:
    limiter: RateLimiter = request.app.state.rate_limiter
    return limiter


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_claims(
    request: Request, settings: Annotated[Settings, Depends(get_settings_dep)]
) -> AccessClaims:
    """The signed-in user. Any 401 here tells the web app to refresh once and retry."""
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise SessionExpired
    try:
        return decode_access_token(settings, token)
    except InvalidAccessToken as exc:
        raise SessionExpired from exc


async def get_tenant_session(
    claims: Annotated[AccessClaims, Depends(get_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AsyncSession:
    """Database session confined to the signed-in user's workspace."""
    bind_workspace(session, claims.workspace_id)
    return session


def _paths(settings: Settings) -> tuple[str, str]:
    prefix = settings.cookie_path_prefix.rstrip("/")
    return f"{prefix}/v1", f"{prefix}/v1/auth"


def set_session_cookies(response: Response, issued: IssuedSession, settings: Settings) -> None:
    api_path, auth_path = _paths(settings)
    refresh_max_age = settings.refresh_token_ttl_days * 86_400
    for name, value, max_age, path in (
        (ACCESS_COOKIE, issued.access_token, settings.access_token_ttl_minutes * 60, api_path),
        (REFRESH_COOKIE, issued.refresh_token, refresh_max_age, auth_path),
        (SESSION_HINT_COOKIE, "1", refresh_max_age, "/"),
    ):
        response.set_cookie(
            name,
            value,
            max_age=max_age,
            path=path,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="lax",
        )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    api_path, auth_path = _paths(settings)
    for name, path in (
        (ACCESS_COOKIE, api_path),
        (REFRESH_COOKIE, auth_path),
        (SESSION_HINT_COOKIE, "/"),
    ):
        response.delete_cookie(
            name, path=path, httponly=True, secure=settings.cookie_secure, samesite="lax"
        )
