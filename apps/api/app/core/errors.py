"""Application errors and FastAPI handlers.

Every error response has the shape::

    {"error": {"code": "validation_error", "message": "<pt-BR text>", "fields": [...]}}

``code`` is a stable English identifier for clients and logs; ``message`` is pt-BR copy that says
what went wrong and how to fix it.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.i18n import translate
from app.core.logging import get_logger

log = get_logger(__name__)


class AppError(Exception):
    def __init__(self, code: str, status_code: int = 400, **params: object) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code
        self.params = params


_HTTP_CODES = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}

_FIELD_ERRORS = {
    "missing": "field.missing",
    "string_too_short": "field.too_short",
    "string_too_long": "field.too_long",
    "int_parsing": "field.invalid_number",
    "float_parsing": "field.invalid_number",
    "value_error.email": "field.invalid_email",
}


_CUSTOM_FIELD_ERRORS = {"invalid_phone": "invalid_phone", "invalid_cep": "field.invalid_cep"}


def _body(code: str, message: str, fields: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    return {"error": error}


async def _app_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):  # pragma: no cover - registered for AppError only
        raise exc
    if exc.status_code >= 500:
        log.error("app_error", code=exc.code, params=exc.params)
    return JSONResponse(
        _body(exc.code, translate(exc.code, exc.params)), status_code=exc.status_code
    )


async def _http_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):  # pragma: no cover
        raise exc
    code = _HTTP_CODES.get(exc.status_code, "internal_error")
    return JSONResponse(_body(code, translate(code)), status_code=exc.status_code)


async def _validation_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):  # pragma: no cover
        raise exc
    fields = []
    # Discriminated unions add the tag (e.g. "auction") to the location; hide it from clients.
    body = exc.body if isinstance(exc.body, dict) else {}
    tags = {str(body["kind"])} if "kind" in body else set()
    for err in exc.errors():
        key = _FIELD_ERRORS.get(str(err.get("type")), "field.invalid")
        ctx = err.get("ctx") or {}
        # Validators raise ValueError("<catalog key>") for domain-specific messages.
        code = str(ctx.get("error", "")) if err.get("type") == "value_error" else ""
        if code in _CUSTOM_FIELD_ERRORS:
            key = _CUSTOM_FIELD_ERRORS[code]
        fields.append(
            {
                "path": [str(p) for p in err.get("loc", ()) if p != "body" and str(p) not in tags],
                "code": str(err.get("type")),
                "message": translate(key, ctx),
            }
        )
    return JSONResponse(
        _body("validation_error", translate("validation_error"), fields), status_code=422
    )


async def _unhandled(_request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled_error", exc_info=exc)
    return JSONResponse(_body("internal_error", translate("internal_error")), status_code=500)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unhandled)
