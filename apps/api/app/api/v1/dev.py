"""Development helpers: the email outbox (404 unless DEV_OUTBOX_ENABLED) and the fake storage
files (404 unless the fake adapter is in use). Both refuse production."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_settings_dep
from app.core.db import get_session
from app.core.errors import AppError
from app.core.settings import Settings
from app.domains.billing import payments
from app.integrations.domains.fake import FakeDomains
from app.integrations.messaging.fake import FakeEmail
from app.integrations.payments.fake import FakePayments
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


class DevDnsIn(BaseModel):
    hostname: str
    txt: list[str] = []
    cname: str | None = None


@router.post("/dns", status_code=204)
async def set_dns(
    data: DevDnsIn,
    settings: Annotated[Settings, Depends(get_settings_dep)],
    integrations: Annotated[Integrations, Depends(get_integrations)],
) -> Response:
    """Simulated DNS for custom domains (fake adapter, outbox enabled, never production)."""
    domains = integrations.domains
    if not settings.dev_outbox_enabled or settings.app_env == "production":
        raise AppError("not_found", status_code=404)
    if not isinstance(domains, FakeDomains):
        raise AppError("not_found", status_code=404)
    domains.set_dns(data.hostname, txt=data.txt, cname=data.cname)
    return Response(status_code=204)


@router.get("/payments/checkout/{session_id}")
async def fake_checkout(
    session_id: str,
    settings: Annotated[Settings, Depends(get_settings_dep)],
    integrations: Annotated[Integrations, Depends(get_integrations)],
    session: Annotated[AsyncSession, Depends(get_session)],
    acao: Annotated[str | None, Query(max_length=10)] = None,
) -> Response:
    """Simulated Stripe Checkout (fake payments adapter, never production): `?acao=pagar` pays
    and delivers the webhook events; `?acao=voltar` returns without paying."""
    port = integrations.payments
    if settings.app_env == "production" or not isinstance(port, FakePayments):
        raise AppError("not_found", status_code=404)
    checkout = port.sessions.get(session_id)
    if checkout is None:
        raise AppError("not_found", status_code=404)
    if acao == "voltar":
        return RedirectResponse(checkout.cancel_url, status_code=303)
    if acao == "pagar" and not checkout.completed:
        for body, signature in port.complete_checkout(session_id):
            event = port.parse_event(body, signature)
            await payments.handle_event(
                session, event, port, email_port=integrations.email, settings=settings
            )
        await session.commit()
        return RedirectResponse(checkout.success_url, status_code=303)
    cents = port.prices.get(checkout.lookup_key, 0)
    page = f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<title>Pagamento simulado</title>
<body style="font-family:sans-serif;max-width:480px;margin:48px auto">
<h1>Pagamento simulado</h1><p>Ambiente de desenvolvimento: nenhum cartão é cobrado.</p>
<p>{checkout.lookup_key} · R$ {cents // 100},{cents % 100:02d}/mês</p>
<p><a href="?acao=pagar">Pagar com cartão de teste</a> ·
<a href="?acao=voltar">Voltar sem pagar</a></p>
</body></html>"""
    return HTMLResponse(page)
