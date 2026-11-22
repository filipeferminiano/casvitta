"""Páginas e domínios (Social): visitor reports, the review queue, suspend with a reason (audited,
emailed), lift, dismiss. Only roles that moderate act; the broker cannot lift a suspension."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.accounts.models import AuditLog, BrokerProfile
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client, outbox, signed_in_as, staff_settings
from tests.test_pages import BROWSER, _whatsapp
from tests.test_properties import _cookie

SETTINGS = staff_settings()
REASON = "Uso de nome e marca de outra imobiliária"


@pytest.fixture
async def api(make_session, integrations: Integrations) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with make_client(make_session, integrations, SETTINGS) as client:
        yield client


async def _published(make_session, integrations, name: str, *, verified: bool) -> BrokerProfile:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, name, verified=verified)
        await setup.commit()
    await _whatsapp(make_session, broker)
    async with make_client(make_session, integrations, SETTINGS) as own:
        assert (await own.post("/v1/page/publish", headers=_cookie(broker))).status_code == 200
    return broker


async def test_report_queue_suspend_and_lift(
    api: AsyncClient, integrations: Integrations, session: AsyncSession, make_session
) -> None:  # type: ignore[no-untyped-def]
    reported = await _published(make_session, integrations, "Lucas Prado", verified=True)
    pending = await _published(make_session, integrations, "João Campinas", verified=False)
    await _published(make_session, integrations, "Tudo Certo", verified=True)

    # A visitor reports from the footer: no contact data asked.
    r = await api.post(
        f"/v1/public/pages/{reported.slug}/reports",
        json={"reason": "impersonation", "details": "  usa fotos   de outra imobiliária "},
        headers=BROWSER,
    )
    assert r.status_code == 204, r.text
    bad = await api.post(f"/v1/public/pages/{reported.slug}/reports", json={"reason": "x"})
    assert bad.status_code == 422

    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)
    queue = (await api.get("/v1/staff/pages")).json()
    assert queue["counts"]["reports"] == 1 and queue["counts"]["review"] == 2
    first, second = queue["items"]
    assert first["slug"] == reported.slug and first["signal"] == "report"
    assert first["signal_text"] == "usa fotos de outra imobiliária"
    assert second["slug"] == pending.slug and second["signal"] == "creci_unverified"
    page_id = first["page_id"]

    detail = (await api.get(f"/v1/staff/pages/{page_id}")).json()
    assert detail["page"]["open_reports"] == 1 and detail["visible_properties"] == 0
    assert "email" not in detail["page"]  # no personal data beyond the public name

    # Leitura reads but cannot act.
    r = await api.post(f"/v1/staff/pages/{page_id}/suspend", json={"reason": REASON})
    assert r.status_code == 403

    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    assert (
        await api.post(f"/v1/staff/pages/{page_id}/suspend", json={"reason": "x"})
    ).status_code == 422
    r = await api.post(f"/v1/staff/pages/{page_id}/suspend", json={"reason": REASON})
    assert r.status_code == 200, r.text
    assert r.json()["page"]["status"] == "suspended" and r.json()["page"]["open_reports"] == 0
    assert r.json()["reports"][0]["status"] == "actioned"
    assert (await api.get(f"/v1/public/pages/{reported.slug}")).status_code == 404
    mail = outbox(integrations).outbox[-1]
    assert mail.subject == "Sua página na Casvitta foi suspensa" and REASON in mail.text

    # The broker cannot switch it back on.
    async with make_client(make_session, integrations, SETTINGS) as own:
        h = _cookie(reported)
        assert (await own.post("/v1/page/publish", headers=h)).status_code == 409
        await own.post("/v1/page/unpublish", headers=h)
        assert (await own.get("/v1/page", headers=h)).json()["status"] == "suspended"

    suspended = (await api.get("/v1/staff/pages?tab=suspended")).json()
    assert [i["slug"] for i in suspended["items"]] == [reported.slug]

    r = await api.post(f"/v1/staff/pages/{page_id}/reactivate", json={"reason": "Corrigiu a foto"})
    assert r.json()["page"]["status"] == "unpublished"  # the broker turns it on again
    async with make_client(make_session, integrations, SETTINGS) as own:
        assert (await own.post("/v1/page/publish", headers=_cookie(reported))).status_code == 200

    actions = (
        await session.scalars(
            select(AuditLog.action).where(
                AuditLog.entity == "broker_page", AuditLog.reason.is_not(None)
            )
        )
    ).all()
    assert set(actions) >= {"pages.suspended", "pages.reactivated"}


async def test_dismiss_report(
    api: AsyncClient, integrations: Integrations, session: AsyncSession, make_session
) -> None:  # type: ignore[no-untyped-def]
    broker = await _published(make_session, integrations, "Mariana Alves", verified=True)
    await api.post(
        f"/v1/public/pages/{broker.slug}/reports", json={"reason": "other"}, headers=BROWSER
    )
    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    page_id = (await api.get("/v1/staff/pages")).json()["items"][0]["page_id"]
    report_id = (await api.get(f"/v1/staff/pages/{page_id}")).json()["reports"][0]["id"]
    r = await api.post(
        f"/v1/staff/page-reports/{report_id}/dismiss", json={"reason": "Página confere com o CRECI"}
    )
    assert r.status_code == 200 and r.json()["reports"][0]["status"] == "dismissed"
    assert r.json()["page"]["status"] == "published"
    again = await api.post(
        f"/v1/staff/page-reports/{report_id}/dismiss", json={"reason": "outra vez"}
    )
    assert again.status_code == 404
    assert (await api.get("/v1/staff/pages")).json()["counts"]["reports"] == 0
