"""Accounts: email-link sign-up/sign-in, sessions, profile, staff CRECI review (§3, §4.1)."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.rate_limit import InMemoryRateLimiter
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import AuditLog, AuthSession, BrokerProfile, LoginToken, User
from app.domains.accounts.service import slugify
from app.integrations.messaging.fake import FakeEmail
from app.integrations.registry import Integrations
from app.main import create_app

ADMIN = "staff-secret"
SITE = "http://localhost:3000"
TOKEN_IN_LINK = re.compile(r"/entrar/confirmar#t=([\w-]+)")


@pytest.fixture
def settings() -> Settings:
    # Cookies at /v1 (no /api prefix): the test client talks to the API directly.
    return Settings(admin_token=ADMIN, cookie_path_prefix="", auth_rate_limit_per_minute=50)


@pytest.fixture
async def api(
    make_session, integrations: Integrations, settings: Settings
) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    app = create_app(
        settings=settings, integrations=integrations, rate_limiter=InMemoryRateLimiter()
    )

    async def _session() -> AsyncIterator[AsyncSession]:
        # A fresh session per request, like production: tenant binding never leaks between calls.
        async with make_session() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def _outbox(integrations: Integrations) -> FakeEmail:
    assert isinstance(integrations.email, FakeEmail)
    return integrations.email


def _last_token(integrations: Integrations) -> str:
    match = TOKEN_IN_LINK.search(_outbox(integrations).outbox[-1].text)
    assert match, "the email must carry a link with the token in the fragment"
    return match.group(1)


async def _sign_up(
    api: AsyncClient, integrations: Integrations, email: str, name: str = "Ana Paula Ribeiro"
) -> None:
    r = await api.post(
        "/v1/auth/email-link",
        json={"email": email, "intent": "sign_up", "name": name, "plan": "essencial"},
    )
    assert r.status_code == 202
    r = await api.post("/v1/auth/confirm", json={"token": _last_token(integrations)})
    assert r.status_code == 200, r.text


# ------------------------------------------------------------------ sign-up / sign-in


async def test_sign_up_creates_account_workspace_and_profile(
    api: AsyncClient, integrations: Integrations
) -> None:
    r = await api.post(
        "/v1/auth/email-link",
        json={"email": " Ana@Exemplo.com.br ", "intent": "sign_up", "name": "Ana Paula Ribeiro"},
    )
    assert r.status_code == 202 and r.json() == {"status": "sent"}
    email = _outbox(integrations).outbox[-1]
    assert email.to == "ana@exemplo.com.br"
    assert email.subject.startswith("Confirme seu e-mail")
    assert f"{SITE}/entrar/confirmar#t=" in email.text

    r = await api.post("/v1/auth/confirm", json={"token": _last_token(integrations)})
    assert r.status_code == 200 and r.json() == {"intent": "sign_up"}
    set_cookie = r.headers.get_list("set-cookie")
    assert any(c.startswith("cv_at=") and "HttpOnly" in c and "Path=/v1" in c for c in set_cookie)
    assert any(c.startswith("cv_rt=") and "Path=/v1/auth" in c for c in set_cookie)

    me = (await api.get("/v1/me")).json()
    assert me["user"]["email"] == "ana@exemplo.com.br"
    assert me["workspace"]["plan"] == "corretor"
    assert me["broker"]["slug"] == "anaribeiro"
    assert me["broker"]["creci_status"] == "missing"


async def test_link_works_once(api: AsyncClient, integrations: Integrations) -> None:
    await api.post("/v1/auth/email-link", json={"email": "a@x.com.br", "intent": "sign_up"})
    token = _last_token(integrations)
    assert (await api.post("/v1/auth/confirm", json={"token": token})).status_code == 200
    again = await api.post("/v1/auth/confirm", json={"token": token})
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "link_invalid"


async def test_expired_link_is_refused(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await api.post("/v1/auth/email-link", json={"email": "a@x.com.br", "intent": "sign_up"})
    await session.execute(update(LoginToken).values(expires_at=utcnow() - timedelta(seconds=1)))
    r = await api.post("/v1/auth/confirm", json={"token": _last_token(integrations)})
    assert r.json()["error"]["code"] == "link_invalid"


async def test_sign_in_with_unknown_email_reveals_nothing(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    r = await api.post(
        "/v1/auth/email-link", json={"email": "nobody@x.com.br", "intent": "sign_in"}
    )
    assert r.status_code == 202 and r.json() == {"status": "sent"}
    assert _outbox(integrations).outbox[-1].subject == "Você ainda não tem conta na Casvitta"
    assert (await session.scalars(select(LoginToken))).all() == []


async def test_signing_up_again_sends_a_sign_in_link(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _sign_up(api, integrations, "ana@x.com.br")
    await api.post(
        "/v1/auth/email-link", json={"email": "ana@x.com.br", "intent": "sign_up", "name": "Outra"}
    )
    assert _outbox(integrations).outbox[-1].subject == "Seu link para entrar na Casvitta"
    r = await api.post("/v1/auth/confirm", json={"token": _last_token(integrations)})
    assert r.json() == {"intent": "sign_in"}
    assert len((await session.scalars(select(User))).all()) == 1


async def test_email_link_is_rate_limited(api: AsyncClient, settings: Settings) -> None:
    settings.auth_rate_limit_per_minute = 2
    body = {"email": "a@x.com.br", "intent": "sign_in"}
    for _ in range(2):
        assert (await api.post("/v1/auth/email-link", json=body)).status_code == 202
    assert (await api.post("/v1/auth/email-link", json=body)).status_code == 429


@pytest.mark.parametrize("email", ["sem-arroba", "a@b", "a b@c.com"])
async def test_invalid_email_is_rejected_in_portuguese(api: AsyncClient, email: str) -> None:
    r = await api.post("/v1/auth/email-link", json={"email": email, "intent": "sign_in"})
    assert r.status_code == 422
    assert r.json()["error"]["fields"][0]["message"].startswith("Digite um e-mail válido")


# ------------------------------------------------------------------ sessions


async def test_me_requires_a_session(api: AsyncClient) -> None:
    r = await api.get("/v1/me")
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_expired"
    api.cookies.set("cv_at", "not-a-jwt", path="/v1")
    assert (await api.get("/v1/me")).status_code == 401


async def test_refresh_rotates_and_reuse_revokes_the_login(
    api: AsyncClient, integrations: Integrations
) -> None:
    await _sign_up(api, integrations, "ana@x.com.br")
    first = api.cookies.get("cv_rt")
    assert (await api.post("/v1/auth/refresh")).status_code == 204
    second = api.cookies.get("cv_rt")
    assert second and second != first

    # Someone replays the old token: every session of this login ends.
    api.cookies.set("cv_rt", first or "", path="/v1/auth")
    assert (await api.post("/v1/auth/refresh")).status_code == 401
    api.cookies.set("cv_rt", second, path="/v1/auth")
    assert (await api.post("/v1/auth/refresh")).status_code == 401


async def test_sign_out_ends_the_session(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _sign_up(api, integrations, "ana@x.com.br")
    token = api.cookies.get("cv_rt")
    r = await api.post("/v1/auth/sign-out")
    assert r.status_code == 204
    assert any(
        c.startswith('cv_at=""') or "Max-Age=0" in c for c in r.headers.get_list("set-cookie")
    )
    rows = (await session.scalars(select(AuthSession))).all()
    assert rows and all(row.revoked_at is not None for row in rows)
    api.cookies.set("cv_rt", token or "", path="/v1/auth")
    assert (await api.post("/v1/auth/refresh")).status_code == 401


async def test_handoff_moves_the_session_once(api: AsyncClient, integrations: Integrations) -> None:
    assert (await api.post("/v1/auth/handoff")).status_code == 401
    await _sign_up(api, integrations, "ana@x.com.br")
    code = (await api.post("/v1/auth/handoff")).json()["code"]
    api.cookies.clear()
    assert (await api.post("/v1/auth/handoff/claim", json={"token": code})).status_code == 204
    assert (await api.get("/v1/me")).json()["user"]["email"] == "ana@x.com.br"
    again = await api.post("/v1/auth/handoff/claim", json={"token": code})
    assert again.status_code == 400


async def test_cookie_requests_from_other_sites_are_refused(
    api: AsyncClient, integrations: Integrations
) -> None:
    await _sign_up(api, integrations, "ana@x.com.br")
    patch = {"display_name": "Ana R."}
    evil = await api.patch(
        "/v1/me/broker-profile", json=patch, headers={"Origin": "https://evil.example"}
    )
    assert evil.status_code == 403 and evil.json()["error"]["code"] == "origin_not_allowed"
    ok = await api.patch("/v1/me/broker-profile", json=patch, headers={"Origin": SITE})
    assert ok.status_code == 200


# ------------------------------------------------------------------ profile and CRECI


async def test_creci_is_pending_until_staff_verify_it(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _sign_up(api, integrations, "ana@x.com.br")
    bad = await api.patch("/v1/me/broker-profile", json={"creci_number": "12345"})
    assert bad.status_code == 422
    assert (
        bad.json()["error"]["fields"][0]["message"] == "Digite os 6 números do CRECI, como 000.000."
    )

    r = await api.patch(
        "/v1/me/broker-profile",
        json={
            "creci_name": "Ana Paula Ribeiro",
            "creci_number": "000000",
            "creci_state": "sp",
            "creci_kind": "F",
            "whatsapp": "(11) 92740-8912",
        },
    )
    profile = r.json()
    assert profile["creci_number"] == "000.000-F" and profile["creci_state"] == "SP"
    assert profile["creci_status"] == "pending"
    assert profile["whatsapp_e164"] == "+5511927408912"

    # Staff: list pending, verify. Without the token, nothing.
    assert (await api.get("/v1/admin/brokers")).status_code == 401
    pending = await api.get(
        "/v1/admin/brokers", params={"creci_status": "pending"}, headers={"X-Admin-Token": ADMIN}
    )
    assert [b["email"] for b in pending.json()] == ["ana@x.com.br"]
    verified = await api.post(
        f"/v1/admin/brokers/{profile['id']}/creci/verify", headers={"X-Admin-Token": ADMIN}
    )
    assert verified.json()["creci_status"] == "verified"
    actions = [a.action for a in (await session.scalars(select(AuditLog))).all()]
    assert actions == ["broker_profile.listed", "broker_profile.creci_verified"]

    # A different number goes back to review.
    r = await api.patch("/v1/me/broker-profile", json={"creci_number": "111.111"})
    assert r.json()["creci_status"] == "pending"


async def test_plan_can_be_changed(api: AsyncClient, integrations: Integrations) -> None:
    await _sign_up(api, integrations, "ana@x.com.br")
    r = await api.patch("/v1/me/workspace", json={"plan": "essencial"})
    assert r.json()["plan"] == "essencial"
    assert (await api.get("/v1/me")).json()["workspace"]["plan"] == "essencial"
    r = await api.patch("/v1/me/workspace", json={"plan": "corretor"})
    assert r.json()["plan"] == "corretor"


async def test_sign_up_without_a_plan_gets_the_broker_plan(
    api: AsyncClient, integrations: Integrations
) -> None:
    r = await api.post(
        "/v1/auth/email-link",
        json={"email": "leo@x.com.br", "intent": "sign_up", "name": "Leo Martins"},
    )
    assert r.status_code == 202
    r = await api.post("/v1/auth/confirm", json={"token": _last_token(integrations)})
    assert r.status_code == 200, r.text
    assert (await api.get("/v1/me")).json()["workspace"]["plan"] == "corretor"


async def test_each_broker_sees_only_their_own_account(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _sign_up(api, integrations, "ana@x.com.br", "Ana Ribeiro")
    api.cookies.clear()
    await _sign_up(api, integrations, "bia@x.com.br", "Bia Souza")
    await api.patch("/v1/me/broker-profile", json={"display_name": "Bia S."})
    me = (await api.get("/v1/me")).json()
    assert me["user"]["email"] == "bia@x.com.br" and me["broker"]["display_name"] == "Bia S."
    with cross_tenant(session):
        names = {p.display_name for p in (await session.scalars(select(BrokerProfile))).all()}
    assert names == {"Ana Ribeiro", "Bia S."}


async def test_slugs_are_unique_and_never_reserved(
    api: AsyncClient, integrations: Integrations
) -> None:
    assert slugify("Ana Paula Ribeiro") == "anaribeiro"
    assert slugify("José Ângelo") == "joseangelo"
    slugs = []
    for i, name in enumerate(["Ana Ribeiro", "Ana Ribeiro", "Api"]):
        api.cookies.clear()
        await _sign_up(api, integrations, f"u{i}@x.com.br", name)
        slugs.append((await api.get("/v1/me")).json()["broker"]["slug"])
    assert slugs == ["anaribeiro", "anaribeiro2", "api2"]


def test_production_needs_a_real_jwt_secret() -> None:
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(app_env="production")
