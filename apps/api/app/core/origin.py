"""CSRF defense in depth for cookie sessions.

Cookies are SameSite=Lax already. On top of that, a state-changing request that carries our
session cookies must come from a Casvitta page: its Origin header, when present, has to be one of
ours. Requests without cookies (public forms, health checks) are not affected.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.core.i18n import translate
from app.core.settings import Settings

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_SESSION_COOKIES = ("cv_at", "cv_rt")


def allowed_origins(settings: Settings) -> frozenset[str]:
    origins = {settings.site_url, settings.app_url, *settings.cors_origins}
    site = urlsplit(settings.site_url)
    origins.add(f"{site.scheme}://www.{site.netloc}")
    return frozenset(o.rstrip("/") for o in origins)


def install_origin_check(app: FastAPI, settings: Settings) -> None:
    allowed = allowed_origins(settings)

    @app.middleware("http")
    async def _check_origin(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method not in _SAFE_METHODS and any(
            name in request.cookies for name in _SESSION_COOKIES
        ):
            origin = request.headers.get("origin")
            if origin is not None and origin.rstrip("/") not in allowed:
                return JSONResponse(
                    {
                        "error": {
                            "code": "origin_not_allowed",
                            "message": translate("origin_not_allowed"),
                        }
                    },
                    status_code=403,
                )
        return await call_next(request)
