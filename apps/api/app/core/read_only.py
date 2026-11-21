"""Read-only customer sessions ("Ver como o cliente", backoffice BO5).

A staff member can open a customer's app to see what they see. That session's token carries the
staff actor ("act"), has no refresh token, and every state-changing request made with it is
refused here, before any router runs. Signing out is the only write allowed.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.core.i18n import translate
from app.core.security import InvalidAccessToken, decode_access_token
from app.core.settings import Settings

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_ALLOWED_WRITES = ("/v1/auth/sign-out",)


def install_read_only_guard(app: FastAPI, settings: Settings) -> None:
    @app.middleware("http")
    async def _read_only(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        token = request.cookies.get("cv_at")
        if (
            token
            and request.method not in _SAFE_METHODS
            and not request.url.path.endswith(_ALLOWED_WRITES)
        ):
            try:
                claims = decode_access_token(settings, token)
            except InvalidAccessToken:
                claims = None
            if claims is not None and claims.read_only:
                return JSONResponse(
                    {
                        "error": {
                            "code": "read_only_session",
                            "message": translate("read_only_session"),
                        }
                    },
                    status_code=403,
                )
        return await call_next(request)
