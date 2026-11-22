"""SOC-1b: custom domains. State machine on the fake DNS/certificate adapter, the page never goes
offline (subdomain fallback), plan gate, uniqueness, public resolve, emails."""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.domains.accounts.models import BrokerProfile, Plan, Workspace
from app.domains.pages import domains
from app.domains.pages.models import CustomDomain, DomainStatus
from app.integrations.domains.fake import FakeDomains
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client, outbox
from tests.test_pages import SETTINGS, _whatsapp
from tests.test_properties import _cookie

HOST = "www.marianaimoveis.com.br"
TARGET = "paginas.casvitta.com.br"


async def _broker(
    make_session, plan: Plan = Plan.AUTOMATION, name: str = "Mariana Alves"
) -> BrokerProfile:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, name, verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    async with make_session() as s:
        with cross_tenant(s):
            workspace = await s.get(Workspace, broker.workspace_id)
            assert workspace is not None
            workspace.plan = plan
            await s.commit()
    return broker


def _fake(integrations: Integrations) -> FakeDomains:
    assert isinstance(integrations.domains, FakeDomains)
    return integrations.domains


async def test_domain_lifecycle_with_fallback(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    broker = await _broker(make_session)
    dns = _fake(integrations)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        await api.post("/v1/page/publish", headers=h)
        sub = f"http://{broker.slug}.localhost:3000"

        r = await api.post(
            "/v1/page/domain", headers=h, json={"hostname": "https://WWW.MarianaImoveis.com.br/"}
        )
        assert r.status_code == 200, r.text
        page = r.json()
        d = page["domain"]
        assert d["hostname"] == HOST and d["status"] == "pending"
        assert d["txt_name"] == f"_casvitta.{HOST}" and d["txt_value"].startswith(
            "casvitta-verify="
        )
        assert d["cname_target"] == TARGET and d["zone"] == "marianaimoveis.com.br"
        assert d["txt_host"] == "_casvitta.www" and d["cname_host"] == "www"
        assert page["url"] == sub  # not active yet: still the subdomain

        # Nothing in DNS yet: stays pending (inside the 48 h), with what is missing.
        page = (await api.post("/v1/page/domain/check", headers=h)).json()
        assert page["domain"]["status"] == "pending"
        assert page["domain"]["error_code"] == "txt_missing"

        dns.set_dns(HOST, txt=[d["txt_value"]], cname="outro.exemplo.com")
        page = (await api.post("/v1/page/domain/check", headers=h)).json()
        assert page["domain"]["error_code"] == "cname_wrong"
        assert page["domain"]["found_value"] == "outro.exemplo.com"

        dns.set_dns(HOST, txt=[d["txt_value"]], cname=f"{TARGET}.")
        page = (await api.post("/v1/page/domain/check", headers=h)).json()
        assert page["domain"]["status"] == "provisioning" and page["url"] == sub
        page = (await api.post("/v1/page/domain/check", headers=h)).json()
        assert page["domain"]["status"] == "active"
        assert page["url"] == f"http://{HOST}:3000" and page["subdomain_url"] == sub
        assert outbox(integrations).outbox[-1].subject == f"{HOST} está no ar"

        # Public: the hostname resolves to the page; the page's address is the domain.
        assert (await api.get(f"/v1/public/domains/{HOST}")).json() == {"slug": broker.slug}
        public = (await api.get(f"/v1/public/pages/{broker.slug}")).json()
        assert public["url"] == f"http://{HOST}:3000"
        qr = await api.get("/v1/page/qr.png", headers=h)
        assert qr.status_code == 200

        # CNAME removed: error, back to the subdomain (never offline), broker emailed.
        dns.set_dns(HOST, txt=[d["txt_value"]])
        page = (await api.post("/v1/page/domain/check", headers=h)).json()
        assert (
            page["domain"]["status"] == "error" and page["domain"]["error_code"] == "cname_missing"
        )
        assert page["url"] == sub
        assert (await api.get(f"/v1/public/domains/{HOST}")).status_code == 404
        mail = outbox(integrations).outbox[-1]
        assert mail.subject == f"{HOST} parou de funcionar" and sub in mail.text

        # Detach: certificate released, row kept as history, can connect again later.
        page = (await api.delete("/v1/page/domain", headers=h)).json()
        assert page["domain"] is None and page["url"] == sub
        r = await api.post("/v1/page/domain", headers=h, json={"hostname": HOST})
        assert r.status_code == 200
    async with make_session() as s:
        with cross_tenant(s):
            rows = (
                await s.scalars(select(CustomDomain.status).where(CustomDomain.hostname == HOST))
            ).all()
    assert sorted(rows) == [DomainStatus.DETACHED, DomainStatus.PENDING]


async def test_plan_gate_uniqueness_and_downgrade(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    free = await _broker(make_session, Plan.ESSENTIAL, "Sem Dominio")
    owner = await _broker(make_session, Plan.AUTOMATION, "Dona Dominio")
    other = await _broker(make_session, Plan.AUTOMATION, "Outra Pessoa")
    dns = _fake(integrations)
    async with make_client(make_session, integrations, SETTINGS) as api:
        r = await api.post("/v1/page/domain", headers=_cookie(free), json={"hostname": HOST})
        assert r.status_code == 403
        assert (await api.get("/v1/page", headers=_cookie(free))).json()[
            "domains_available"
        ] is False

        h = _cookie(owner)
        await api.post("/v1/page/publish", headers=h)
        token = (await api.post("/v1/page/domain", headers=h, json={"hostname": HOST})).json()[
            "domain"
        ]["txt_value"]
        r = await api.post("/v1/page/domain", headers=_cookie(other), json={"hostname": HOST})
        assert r.status_code == 409 and r.json()["error"]["code"] == "domain_taken"
        r = await api.post("/v1/page/domain", headers=h, json={"hostname": "www.outro.com.br"})
        assert r.json()["error"]["code"] == "domain_already_connected"

        dns.set_dns(HOST, txt=[token], cname=TARGET)
        await api.post("/v1/page/domain/check", headers=h)
        await api.post("/v1/page/domain/check", headers=h)
        assert (await api.get(f"/v1/public/domains/{HOST}")).status_code == 200

        # Downgrade: the record stays; the domain stops serving and the page is on the subdomain.
        async with make_session() as s:
            with cross_tenant(s):
                workspace = await s.get(Workspace, owner.workspace_id)
                assert workspace is not None
                workspace.plan = Plan.ESSENTIAL
                await s.commit()
        assert (await api.get(f"/v1/public/domains/{HOST}")).status_code == 404
        page = (await api.get("/v1/page", headers=h)).json()
        assert page["domain"]["status"] == "active" and page["url"] == page["subdomain_url"]


async def test_pending_turns_error_after_the_wait_and_cert_failure(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    broker = await _broker(make_session)
    dns = _fake(integrations)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        token = (await api.post("/v1/page/domain", headers=h, json={"hostname": HOST})).json()[
            "domain"
        ]["txt_value"]
    async with make_session() as s:
        with cross_tenant(s):
            domain = await s.scalar(select(CustomDomain).where(CustomDomain.hostname == HOST))
            assert domain is not None
            await domains.check(
                s, domain, dns, SETTINGS, now=domain.created_at + timedelta(hours=49)
            )
            assert domain.status == DomainStatus.ERROR and domain.error_code == "txt_missing"
            dns.set_dns(HOST, txt=[token], cname=TARGET)
            dns.failing.add(HOST)
            await domains.check(s, domain, dns, SETTINGS)
            assert domain.status == DomainStatus.PROVISIONING
            await domains.check(s, domain, dns, SETTINGS)
            assert domain.status == DomainStatus.ERROR and domain.error_code == "cert_failed"


@pytest.mark.parametrize(
    ("raw", "code"),
    [
        ("marianaimoveis.com.br", "domain_apex"),
        ("mariana.imb.br", "domain_apex"),
        ("www.casvitta.com.br", "domain_reserved"),
        ("mariana.casvitta.com.br", "domain_reserved"),
        ("www.minhacasvitta.com", "domain_reserved"),
        ("www.-bad.com", "domain_invalid"),
        ("localhost", "domain_invalid"),
    ],
)
def test_hostname_rules(raw: str, code: str) -> None:
    prod = Settings(site_url="https://www.casvitta.com.br")
    with pytest.raises(ValueError, match=code):
        domains.normalize_hostname(raw, prod)


def test_hostname_normalized_and_url() -> None:
    prod = Settings(site_url="https://www.casvitta.com.br")
    assert domains.normalize_hostname("https://Imóveis.Mariana.com.br/x", prod) == (
        "xn--imveis-cxa.mariana.com.br"
    )
    assert domains.domain_url(prod, HOST) == f"https://{HOST}"
