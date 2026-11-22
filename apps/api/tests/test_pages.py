"""SOC-1a: broker page (Casvitta Social). CRECI gate on the page and its properties (rule 1),
authorization gate (rule 2), demo never public (rule 7), visit counters without personal data."""

from __future__ import annotations

from sqlalchemy import select

from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import BrokerProfile, Plan, Workspace
from app.domains.listings.models import Channel
from app.domains.pages import service
from app.domains.pages.models import PageEvent
from app.domains.properties import service as properties
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client
from tests.test_properties import TODAY, _cookie, bound, ready_property

SETTINGS = Settings(cookie_path_prefix="")
OPEN = Settings(cookie_path_prefix="", page_requires_verified_creci=False)
BROWSER = {"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148"}


async def _whatsapp(make_session, broker: BrokerProfile) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as s:
        with cross_tenant(s):
            profile = await s.get(BrokerProfile, broker.id)
            assert profile is not None
            profile.whatsapp_e164 = "+5511927408912"
            await s.commit()


async def test_onboarding_page_publish_and_public_read(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        await setup.commit()
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        r = await api.get("/v1/page", headers=h)
        assert r.status_code == 200, r.text
        page = r.json()
        assert page["status"] == "draft" and page["theme"] == "cambui"
        assert page["url"] == f"http://{broker.slug}.localhost:3000"
        assert page["blockers"] == ["whatsapp_missing"]
        assert page["branded"] is True  # Grátis keeps "Crie sua página com a Casvitta"

        # Publishing needs the WhatsApp (the page's one action).
        assert (await api.post("/v1/page/publish", headers=h)).status_code == 409
        r = await api.patch(
            "/v1/page",
            headers=h,
            json={
                "whatsapp": "(19) 99876-5432",
                "theme": "terracota",
                "bio": "  Ajudo famílias em Campinas.  ",
                "regions": ["Cambuí", "Taquaral", "Cambuí"],
                "onboarding_step": 5,
            },
        )
        assert r.status_code == 200, r.text
        page = r.json()
        assert page["whatsapp_e164"] == "+5519998765432"
        assert page["bio"] == "Ajudo famílias em Campinas."
        assert page["regions"] == ["Cambuí", "Taquaral"]
        assert page["onboarding_step"] == 5 and page["blockers"] == []
        # The step only moves forward.
        r = await api.patch("/v1/page", headers=h, json={"onboarding_step": 3})
        assert r.json()["onboarding_step"] == 5

        assert (await api.get(f"/v1/public/pages/{broker.slug}")).status_code == 404  # draft
        r = await api.post("/v1/page/publish", headers=h)
        assert r.json()["status"] == "published" and r.json()["is_live"] is True

        r = await api.get(f"/v1/public/pages/{broker.slug.upper()}")
        assert r.status_code == 200, r.text
        public = r.json()
        assert public["creci"] == "CRECI-SP 123.456-F" and public["creci_verified"] is True
        assert public["theme"] == "terracota" and public["properties"] == []
        assert "email" not in public

        await api.post("/v1/page/unpublish", headers=h)
        assert (await api.get(f"/v1/public/pages/{broker.slug}")).status_code == 404


async def test_page_needs_verified_creci_unless_configured(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        pending = await add_broker(setup, "Paula Pendente", verified=False)
        none = await add_broker(setup, "Sem Creci", creci=None)
        await setup.commit()
    await _whatsapp(make_session, pending)
    await _whatsapp(make_session, none)
    async with make_client(make_session, integrations, SETTINGS) as api:
        assert (await api.post("/v1/page/publish", headers=_cookie(none))).status_code == 409
        r = await api.post("/v1/page/publish", headers=_cookie(pending))
        assert r.status_code == 200
        # Published by the broker, but not public until staff verify the CRECI (rule 1).
        assert r.json()["is_live"] is False
        assert (await api.get(f"/v1/public/pages/{pending.slug}")).status_code == 404
    async with make_client(make_session, integrations, OPEN) as api:
        r = await api.get(f"/v1/public/pages/{pending.slug}")
        assert r.status_code == 200
        assert r.json()["creci_verified"] is False and r.json()["properties"] == []


async def test_page_shows_only_checked_bio_listings_of_this_broker(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    s = await bound(make_session, broker)
    shown = await ready_property(s, broker)
    waiting = await ready_property(s, broker, verified=False)
    portal_only = await ready_property(s, broker)
    await properties.publish(s, shown.id, Channel.BIO_PAGE, TODAY)
    await properties.publish(s, waiting.id, Channel.BIO_PAGE, TODAY)  # pending staff check
    await properties.publish(s, portal_only.id, Channel.MARKETPLACE, TODAY)
    page, profile = await service.get_or_create(s, broker.user_id)
    await service.publish(s, page, profile)
    await s.commit()
    await s.close()
    async with make_client(make_session, integrations, SETTINGS) as api:
        public = (await api.get(f"/v1/public/pages/{broker.slug}")).json()
        assert [p["code"] for p in public["properties"]] == [shown.code]
        mine = (await api.get("/v1/page", headers=_cookie(broker))).json()
        assert mine["checklist"]["has_properties"] is True


async def test_demo_page_is_never_public(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        demo = await add_broker(setup, "Ana Ribeiro", verified=True, is_demo=True)
        await setup.commit()
    await _whatsapp(make_session, demo)
    async with make_client(make_session, integrations, SETTINGS) as api:
        assert (await api.post("/v1/page/publish", headers=_cookie(demo))).status_code == 200
        assert (await api.get(f"/v1/public/pages/{demo.slug}")).status_code == 404


async def test_events_count_once_a_day_skip_bots_and_paid_plan_unbrands(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        await api.post("/v1/page/publish", headers=h)
        url = f"/v1/public/pages/{broker.slug}/events"
        for _ in range(3):
            r = await api.post(url, json={"kind": "page_view", "source": "qr"}, headers=BROWSER)
            assert r.status_code == 204, r.text
        await api.post(url, json={"kind": "whatsapp_click"}, headers=BROWSER)
        await api.post(
            url, json={"kind": "property_view", "property_code": "CV-12"}, headers=BROWSER
        )
        bot = {"user-agent": "facebookexternalhit/1.1"}
        await api.post(url, json={"kind": "page_view"}, headers=bot)
        bad = await api.post(url, json={"kind": "property_view", "property_code": "x"})
        assert bad.status_code == 422

        stats = (await api.get("/v1/page/stats", headers=h)).json()
        assert stats["page_views"] == 1 and stats["whatsapp_clicks"] == 1
        assert stats["property_views"] == 1 and stats["by_source"]["qr"] == 1
        assert (await api.get("/v1/page", headers=h)).json()["checklist"]["link_used"] is True

        qr = await api.get("/v1/page/qr.png", headers=h)
        assert qr.status_code == 200 and qr.content.startswith(b"\x89PNG")
        pdf = await api.get("/v1/page/qr.pdf", headers=h)
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    async with make_session() as s:
        with cross_tenant(s):
            keys = (await s.scalars(select(PageEvent.visitor_key))).all()
            workspace = await s.get(Workspace, broker.workspace_id)
            assert workspace is not None
            workspace.plan = Plan.ESSENTIAL
            await s.commit()
    assert all(len(k) == 64 for k in keys)  # a hash, never the IP
    async with make_client(make_session, integrations, SETTINGS) as api:
        assert (await api.get(f"/v1/public/pages/{broker.slug}")).json()["branded"] is False


async def test_paused_workspace_hides_page(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        await api.post("/v1/page/publish", headers=h)
        async with make_session() as s:
            with cross_tenant(s):
                workspace = await s.get(Workspace, broker.workspace_id)
                assert workspace is not None
                workspace.publishing_paused_at = utcnow()
                await s.commit()
        assert (await api.get(f"/v1/public/pages/{broker.slug}")).status_code == 404
        assert (await api.get("/v1/page", headers=h)).status_code == 200


def test_page_url_and_bots() -> None:
    prod = Settings(site_url="https://www.casvitta.com.br")
    assert service.page_url(prod, "marianaalves") == "https://marianaalves.casvitta.com.br"
    assert service.is_bot("") and service.is_bot("Googlebot/2.1")
    assert not service.is_bot(BROWSER["user-agent"])
