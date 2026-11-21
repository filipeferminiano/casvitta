"""End-to-end test helpers. 404 unless DEV_OUTBOX_ENABLED (refused in production by settings)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.v1.deps import get_settings_dep
from app.core.errors import AppError
from app.core.settings import Settings
from app.integrations.messaging.fake import FakeEmail
from app.integrations.registry import Integrations, get_integrations

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
