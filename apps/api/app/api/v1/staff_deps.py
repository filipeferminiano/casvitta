"""Backoffice request dependencies: who is acting, and one permission check per action.

A request acts either as a signed-in staff member (cookies set on the admin host) or, only while
ADMIN_TOKEN_ENABLED is on, as a script presenting X-Admin-Token. Customer sessions never pass.
"""

from __future__ import annotations

import secrets
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Header, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_settings_dep
from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import InvalidAccessToken, StaffClaims, decode_staff_token
from app.core.settings import Settings
from app.domains.staff import service
from app.domains.staff.audit import Actor
from app.domains.staff.permissions import SENSITIVE, Permission
from app.domains.staff.service import StaffSessionExpired

STAFF_ACCESS_COOKIE = "cv_st_at"
STAFF_REFRESH_COOKIE = "cv_st_rt"
# Not secret: lets the web proxy send signed-out visitors to the sign-in page before rendering.
STAFF_SESSION_HINT_COOKIE = "cv_st_session"

SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _paths(settings: Settings) -> tuple[str, str]:
    prefix = settings.cookie_path_prefix.rstrip("/")
    return f"{prefix}/v1/staff", f"{prefix}/v1/staff/auth"


def _cookie(  # noqa: PLR0917
    response: Response, settings: Settings, name: str, value: str, max_age: int, path: str
) -> None:
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        path=path,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )


def set_staff_access_cookie(response: Response, token: str, settings: Settings) -> None:
    api_path, _ = _paths(settings)
    ttl = settings.staff_access_token_ttl_minutes * 60
    _cookie(response, settings, STAFF_ACCESS_COOKIE, token, ttl, api_path)


def set_staff_cookies(response: Response, issued: service.IssuedStaffSession, s: Settings) -> None:
    _, auth_path = _paths(s)
    max_age = s.staff_session_max_hours * 3600
    set_staff_access_cookie(response, issued.access_token, s)
    _cookie(response, s, STAFF_REFRESH_COOKIE, issued.refresh_token, max_age, auth_path)
    _cookie(response, s, STAFF_SESSION_HINT_COOKIE, "1", max_age, "/")


def clear_staff_cookies(response: Response, settings: Settings) -> None:
    api_path, auth_path = _paths(settings)
    for name, path in (
        (STAFF_ACCESS_COOKIE, api_path),
        (STAFF_REFRESH_COOKIE, auth_path),
        (STAFF_SESSION_HINT_COOKIE, "/"),
    ):
        response.delete_cookie(
            name, path=path, httponly=True, secure=settings.cookie_secure, samesite="strict"
        )


def get_staff_claims(request: Request, settings: SettingsDep) -> StaffClaims:
    token = request.cookies.get(STAFF_ACCESS_COOKIE)
    if not token:
        raise StaffSessionExpired
    try:
        return decode_staff_token(settings, token)
    except InvalidAccessToken as exc:
        raise StaffSessionExpired from exc


async def get_actor(
    request: Request,
    settings: SettingsDep,
    session: SessionDep,
    x_admin_token: Annotated[str | None, Header()] = None,
) -> Actor:
    """Any staff member (every role reads the backoffice) or an enabled script token."""
    if x_admin_token is not None:
        expected = settings.admin_token.get_secret_value() if settings.admin_token else None
        if (
            settings.admin_token_enabled
            and expected
            and secrets.compare_digest(expected, x_admin_token)
        ):
            return Actor.admin_token()
        raise AppError("unauthorized", status_code=401)
    claims = get_staff_claims(request, settings)
    if not await service.session_is_live(session, claims.family_id):
        raise StaffSessionExpired
    staff = await service.load_active_staff(session, claims.staff_id)
    return service.actor_for(staff, claims.authenticated_at)


ActorDep = Annotated[Actor, Depends(get_actor)]


def require_permission(permission: Permission) -> Callable[..., Awaitable[Actor]]:
    """Dependency for one permission. Sensitive ones also need a recent proof of identity."""

    async def _check(actor: ActorDep, settings: SettingsDep) -> Actor:
        if not actor.can(permission):
            raise AppError("forbidden", status_code=403)
        if permission in SENSITIVE:
            service.ensure_recent_auth(settings, actor)
        return actor

    _check.__name__ = f"require_{permission.value.replace('.', '_')}"
    return _check


async def require_recent_auth(actor: ActorDep, settings: SettingsDep) -> Actor:
    service.ensure_recent_auth(settings, actor)
    return actor


async def require_admin_token(actor: ActorDep) -> Actor:
    if actor.kind != "admin_token":
        raise AppError("forbidden", status_code=403)
    return actor
