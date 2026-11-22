"""Paid plans through Stripe (fake adapter, Stripe-shaped signed webhooks): checkout, plan follows
the subscription, prorated change, cancel at period end, failed renewals, idempotent events."""

from __future__ import annotations

import time
from urllib.parse import parse_qs

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.core.catalog import paid_price_cents, plan_from_lookup_key, price_lookup_key
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.domains.accounts.models import BrokerProfile, Plan, Workspace
from app.domains.billing.models import LedgerEntry, LedgerStatus, Subscription
from app.integrations.base import IntegrationError
from app.integrations.payments.events import sign, verify
from app.integrations.payments.fake import FakePayments
from app.integrations.payments.port import InvalidSignature
from app.integrations.payments.stripe import StripePayments, encode
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client, outbox
from tests.test_properties import _cookie

SETTINGS = Settings(cookie_path_prefix="", billing_enabled=True)
OFF = Settings(cookie_path_prefix="")


def _fake(integrations: Integrations) -> FakePayments:
    assert isinstance(integrations.payments, FakePayments)
    integrations.payments.prices = paid_price_cents()
    return integrations.payments


async def _broker(make_session, name: str = "Mariana Alves") -> BrokerProfile:  # type: ignore[no-untyped-def]
    async with make_session() as s:
        broker = await add_broker(s, name, verified=True)
        await s.commit()
    return broker


async def _deliver(api: AsyncClient, deliveries: list[tuple[bytes, str]]) -> list[str]:
    outcomes = []
    for body, signature in deliveries:
        r = await api.post(
            "/v1/webhooks/stripe", content=body, headers={"Stripe-Signature": signature}
        )
        assert r.status_code == 200, r.text
        outcomes.append(r.json()["outcome"])
    return outcomes


async def _plan(make_session, broker: BrokerProfile) -> Plan:  # type: ignore[no-untyped-def]
    async with make_session() as s:
        with cross_tenant(s):
            workspace = await s.get(Workspace, broker.workspace_id)
            assert workspace is not None
            return workspace.plan


async def _subscribe(api: AsyncClient, fake: FakePayments, h: dict[str, str], plan: str) -> str:
    r = await api.post("/v1/me/plan/checkout", headers=h, json={"plan": plan})
    assert r.status_code == 200, r.text
    assert r.json()["result"] == "checkout"
    session_id = r.json()["url"].rsplit("/", 1)[1]
    await _deliver(api, fake.complete_checkout(session_id))
    return next(iter(reversed(fake.subscriptions)))


async def test_checkout_then_plan_follows_the_subscription(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    broker = await _broker(make_session)
    fake = _fake(integrations)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        r = await api.post("/v1/me/plan/checkout", headers=h, json={"plan": "automation"})
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["result"] == "checkout" and "/dev/payments/checkout/cs_" in out["url"]
        session_id = out["url"].rsplit("/", 1)[1]
        assert fake.sessions[session_id].success_url.endswith("/plano?pagamento=ok")

        # Not paid yet: still Grátis, the request waits for the payment.
        usage = (await api.get("/v1/me/plan", headers=h)).json()
        assert usage["plan"] == "free" and usage["open_request"]["status"] == "awaiting_payment"

        deliveries = fake.complete_checkout(session_id)
        assert await _deliver(api, deliveries) == [
            "subscription_synced",
            "payment_recorded",
            "checkout_completed",
        ]
        usage = (await api.get("/v1/me/plan", headers=h)).json()
        assert usage["plan"] == "automation" and usage["open_request"] is None
        assert usage["subscription"]["status"] == "active"
        assert usage["subscription"]["cancel_at_period_end"] is False

        # Stripe retries deliveries: each event counts once.
        assert set(await _deliver(api, deliveries)) == {"duplicate"}

        bad = await api.post(
            "/v1/webhooks/stripe", content=deliveries[0][0], headers={"Stripe-Signature": "t=1"}
        )
        assert bad.status_code == 400
    async with make_session() as s:
        with cross_tenant(s):
            entries = (await s.scalars(select(LedgerEntry))).all()
    assert [(e.amount_cents, e.status, e.plan) for e in entries] == [
        (14_900, LedgerStatus.RECEIVED, Plan.AUTOMATION)
    ]


async def test_change_cancel_resume_and_end(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    broker = await _broker(make_session)
    fake = _fake(integrations)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        sub_id = await _subscribe(api, fake, h, "essential")

        # Upgrade with a subscription: prorated, now.
        r = (await api.post("/v1/me/plan/checkout", headers=h, json={"plan": "pro"})).json()
        assert r["result"] == "changed" and await _plan(make_session, broker) == Plan.PRO
        # The difference was not paid: the old plan stays.
        fake.decline_next_change = True
        r = (await api.post("/v1/me/plan/checkout", headers=h, json={"plan": "agency"})).json()
        assert r["result"] == "pending" and await _plan(make_session, broker) == Plan.PRO
        again = await api.post("/v1/me/plan/checkout", headers=h, json={"plan": "pro"})
        assert again.status_code == 409

        # Back to Grátis: only at the end of the paid period, and it can be undone.
        usage = (await api.post("/v1/me/plan/downgrade", headers=h)).json()
        assert usage["plan"] == "pro" and usage["subscription"]["cancel_at_period_end"] is True
        usage = (await api.post("/v1/me/plan/resume", headers=h)).json()
        assert usage["subscription"]["cancel_at_period_end"] is False
        await api.post("/v1/me/plan/downgrade", headers=h)

        await _deliver(api, [fake.set_status(sub_id, "canceled")])
        usage = (await api.get("/v1/me/plan", headers=h)).json()
        assert usage["plan"] == "free" and usage["subscription"] is None

        portal = await api.post("/v1/me/plan/portal", headers=h)
        assert portal.status_code == 200 and "/plano" in portal.json()["url"]


async def test_failed_renewal_keeps_the_plan_then_free(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    broker = await _broker(make_session)
    fake = _fake(integrations)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        sub_id = await _subscribe(api, fake, h, "automation")

        assert await _deliver(api, [fake.invoice_failed(sub_id)]) == ["payment_failed"]
        mail = outbox(integrations).outbox[-1]
        assert mail.subject == "Não conseguimos cobrar seu plano Casvitta"
        await _deliver(api, [fake.set_status(sub_id, "past_due")])
        usage = (await api.get("/v1/me/plan", headers=h)).json()
        assert usage["plan"] == "automation" and usage["subscription"]["payment_failed"] is True
        r = await api.post("/v1/me/plan/checkout", headers=h, json={"plan": "pro"})
        assert r.status_code == 409 and r.json()["error"]["code"] == "payment_problem"

        await _deliver(api, [fake.set_status(sub_id, "unpaid")])
        assert await _plan(make_session, broker) == Plan.FREE
    async with make_session() as s:
        with cross_tenant(s):
            count = await s.scalar(select(func.count()).select_from(Subscription))
    assert count == 1  # history kept


async def test_billing_off_and_tenancy(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    one = await _broker(make_session, "Ana Ribeiro")
    other = await _broker(make_session, "Outra Pessoa")
    fake = _fake(integrations)
    async with make_client(make_session, integrations, OFF) as api:
        r = await api.post("/v1/me/plan/checkout", headers=_cookie(one), json={"plan": "pro"})
        assert r.status_code == 409 and r.json()["error"]["code"] == "billing_disabled"
        # Without a subscription, "voltar para o Grátis" is immediate (as before).
        assert (await api.post("/v1/me/plan/downgrade", headers=_cookie(one))).status_code == 200
    async with make_client(make_session, integrations, SETTINGS) as api:
        free = await api.post("/v1/me/plan/checkout", headers=_cookie(one), json={"plan": "free"})
        assert free.status_code == 422
        await _subscribe(api, fake, _cookie(one), "pro")
    assert await _plan(make_session, one) == Plan.PRO
    assert await _plan(make_session, other) == Plan.FREE


def test_lookup_keys_and_signatures() -> None:
    assert price_lookup_key(Plan.AUTOMATION) == "casvitta_plan_automation_monthly"
    assert plan_from_lookup_key("casvitta_plan_automation_monthly") == Plan.AUTOMATION
    assert plan_from_lookup_key("casvitta_plan_pro_annual") == Plan.PRO
    assert plan_from_lookup_key("other") is None
    body = b'{"id":"evt_1"}'
    verify(body, sign(body, "whsec_x"), "whsec_x")
    with pytest.raises(InvalidSignature):
        verify(body, sign(body, "whsec_other"), "whsec_x")
    with pytest.raises(InvalidSignature):  # replayed after the tolerance
        verify(body, sign(body, "whsec_x", int(time.time()) - 600), "whsec_x")


async def test_stripe_adapter_requests() -> None:
    """The real adapter's form encoding and calls, against a mocked Stripe."""
    calls: list[tuple[str, str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.content.decode() or request.url.query.decode()
        calls.append((request.method, request.url.path, body))
        if request.url.path == "/v1/prices":
            return httpx.Response(200, json={"data": [{"id": "price_123"}]})
        if request.url.path == "/v1/checkout/sessions":
            url = "https://checkout.stripe.com/c/1"
            return httpx.Response(200, json={"id": "cs_1", "url": url})
        return httpx.Response(402, json={"error": {"code": "card_declined", "type": "card_error"}})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    stripe = StripePayments("sk_test_x", "whsec_x", client=client)
    out = await stripe.create_checkout(
        customer_id="cus_1",
        lookup_key="casvitta_plan_pro_monthly",
        reference="req-1",
        workspace_id="ws-1",
        success_url="https://app/plano?pagamento=ok",
        cancel_url="https://app/plano?pagamento=cancelado",
    )
    assert out.url == "https://checkout.stripe.com/c/1"
    form = parse_qs(calls[-1][2])
    assert form["line_items[0][price]"] == ["price_123"]
    assert form["payment_method_types[0]"] == ["card"]
    assert form["subscription_data[metadata][workspace_id]"] == ["ws-1"]
    assert form["client_reference_id"] == ["req-1"] and form["locale"] == ["pt-BR"]
    with pytest.raises(IntegrationError):
        await stripe.portal_url("cus_1", "https://app/plano")
    assert encode({"a": {"b": [{"c": 1}, 2]}, "d": True, "e": None}) == [
        ("a[b][0][c]", "1"),
        ("a[b][1]", "2"),
        ("d", "true"),
    ]


async def test_allowlist_while_trying_billing(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    owner = await _broker(make_session, "Dono Casvitta")
    other = await _broker(make_session, "Outro Corretor")
    async with make_session() as s:
        with cross_tenant(s):
            from app.domains.accounts.models import User  # noqa: PLC0415

            email = (await s.get(User, owner.user_id)).email  # type: ignore[union-attr]
    _fake(integrations)
    trying = Settings(
        cookie_path_prefix="", billing_enabled=True, billing_allowed_emails=[email.upper()]
    )
    async with make_client(make_session, integrations, trying) as api:
        assert (await api.get("/v1/me/plan", headers=_cookie(owner))).json()["billing_enabled"]
        usage = (await api.get("/v1/me/plan", headers=_cookie(other))).json()
        assert usage["billing_enabled"] is False  # keeps the request to staff
        r = await api.post("/v1/me/plan/checkout", headers=_cookie(other), json={"plan": "pro"})
        assert r.status_code == 409 and r.json()["error"]["code"] == "billing_disabled"
        r = await api.post("/v1/me/plan/checkout", headers=_cookie(owner), json={"plan": "pro"})
        assert r.json()["result"] == "checkout"


def test_production_test_key_needs_an_allowlist() -> None:
    prod = {
        "app_env": "production",
        "jwt_secret": "x" * 40,
        "billing_enabled": True,
        "stripe_secret_key": "sk_test_abc",
        "stripe_webhook_secret": "whsec_abc",
    }
    with pytest.raises(ValueError, match="BILLING_ALLOWED_EMAILS"):
        Settings(**prod)
    ok = Settings(**prod, billing_allowed_emails="dono@exemplo.com.br, Outro@Exemplo.com.br")
    assert ok.billing_allowed_emails == ["dono@exemplo.com.br", "outro@exemplo.com.br"]
