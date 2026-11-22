"""Development helpers: the email outbox (404 unless DEV_OUTBOX_ENABLED) and the fake storage
files (404 unless the fake adapter is in use). Both refuse production."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from app.api.v1.deps import get_settings_dep
from app.core.errors import AppError
from app.core.settings import Settings
from app.integrations.messaging.fake import FakeEmail
from app.integrations.registry import Integrations, get_integrations
from app.integrations.storage.fake import FakeStorage

router = APIRouter(prefix="/dev", tags=["dev"], include_in_schema=False)


class OutboxEmail(BaseModel):
    to: str
    subject: str
    text: str


@router.get("/outbox", response_model=list[OutboxEmail])
async def outbox(
    settings: Annotated[Settings, Depends(get_settings_dep)],
    integrations: Annotated[Integrations, Depends(get_integrations)],
    to: Annotated[str | None, Query(max_length=320)] = None,
) -> list[OutboxEmail]:
    email = integrations.email
    if not settings.dev_outbox_enabled or settings.app_env == "production":
        raise AppError("not_found", status_code=404)
    if not isinstance(email, FakeEmail):
        raise AppError("not_found", status_code=404)
    return [
        OutboxEmail(to=e.to, subject=e.subject, text=e.text)
        for e in email.outbox
        if to is None or e.to == to.lower()
    ]


@router.get("/storage/{key:path}")
async def fake_storage_object(
    key: str,
    settings: Annotated[Settings, Depends(get_settings_dep)],
    integrations: Annotated[Integrations, Depends(get_integrations)],
) -> Response:
    """Files kept by the fake storage adapter (in memory, lost on restart). Never in production."""
    storage = integrations.storage
    if settings.app_env == "production" or not isinstance(storage, FakeStorage):
        raise AppError("not_found", status_code=404)
    stored = storage.objects.get(key)
    if stored is None:
        raise AppError("not_found", status_code=404)
    data, content_type = stored
    return Response(data, media_type=content_type, headers={"Cache-Control": "no-store"})
