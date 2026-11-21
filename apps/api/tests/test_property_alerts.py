"""Property alerts from price pages: consent, honeypot, slugs resolved server-side, admin list."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.rate_limit import InMemoryRateLimiter
from app.core.settings import Settings
from app.domains.alerts.models import PropertyAlert, PropertyAlertConsent
from app.integrations.registry import Integrations
from app.main import create_app
from app.scripts.seed_market_demo import seed_demo

ADMIN = {"X-Admin-Token": "test-admin-token"}
URL = "/v1/public/property-alerts"


@pytest.fixture
async def api(session: AsyncSession, integrations: Integrations) -> AsyncIterator[AsyncClient]:
    await seed_demo(session)
    settings = Settings(
        admin_token=ADMIN["X-Admin-Token"],
        admin_token_enabled=True,
        interest_rate_limit_per_minute=3,
    )
    app = create_app(
        settings=settings, integrations=integrations, rate_limiter=InMemoryRateLimiter()
    )

    async def _session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _session
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def payload(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "scope": "building",
        "city": "sao-paulo",
        "neighborhood": "vila-mariana",
        "building": "condominio-jardim-exemplo",
        "intent": "buy",
        "name": "Pessoa Fictícia",
        "phone": "(11) 90000-0000",
        "consents": {"contact_about_properties": True, "marketing": False},
        "source_page": "/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo",
    }
    return body | overrides


async def _count(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).select_from(PropertyAlert)) or 0


async def test_stores_alert_with_consents(api: AsyncClient, session: AsyncSession) -> None:
    response = await api.post(URL, json=payload())
    assert response.status_code == 202
    assert response.json() == {"status": "stored"}
    alert = await session.scalar(select(PropertyAlert))
    assert alert is not None
    assert (alert.scope, alert.intent, alert.phone_e164) == ("building", "buy", "+5511900000000")
    consents = {
        c.purpose: (c.granted, c.source)
        for c in await session.scalars(select(PropertyAlertConsent))
    }
    page = "/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo"
    assert consents == {
        "contact_about_properties": (True, page),
        "marketing": (False, page),
    }


async def test_neighborhood_and_street_scopes(api: AsyncClient, session: AsyncSession) -> None:
    neighborhood = payload(scope="neighborhood", building=None, intent="own_sell")
    assert (await api.post(URL, json=neighborhood)).status_code == 202
    street = payload(scope="street", building=None, street="rua-das-acacias-ficticias")
    assert (await api.post(URL, json=street)).status_code == 202
    assert await _count(session) == 2


async def test_requires_contact_consent(api: AsyncClient, session: AsyncSession) -> None:
    body = payload(consents={"contact_about_properties": False, "marketing": True})
    response = await api.post(URL, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "consent_required"
    assert await _count(session) == 0


async def test_honeypot_is_answered_like_success_but_not_stored(
    api: AsyncClient, session: AsyncSession
) -> None:
    response = await api.post(URL, json=payload(website="http://spam.example"))
    assert response.status_code == 202
    assert await _count(session) == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"phone": "123"},
        {"email": "sem-arroba"},
        {"scope": "street", "building": None},  # street alert without a street slug
        {"name": "A"},
    ],
)
async def test_rejects_invalid_input(api: AsyncClient, overrides: dict[str, Any]) -> None:
    assert (await api.post(URL, json=payload(**overrides))).status_code == 422


async def test_unknown_place_is_404(api: AsyncClient) -> None:
    response = await api.post(URL, json=payload(building="nao-existe"))
    assert response.status_code == 404


async def test_rate_limited(api: AsyncClient) -> None:
    codes = [(await api.post(URL, json=payload())).status_code for _ in range(4)]
    assert codes == [202, 202, 202, 429]


async def test_admin_list_and_delete(api: AsyncClient, session: AsyncSession) -> None:
    await api.post(
        URL,
        json=payload(
            email="Pessoa@Exemplo.com.br",
            consents={"contact_about_properties": True, "marketing": True},
        ),
    )
    assert (await api.get("/v1/admin/property-alerts")).status_code == 401
    listed = (await api.get("/v1/admin/property-alerts", headers=ADMIN)).json()
    assert len(listed) == 1
    row = listed[0]
    assert row["scope_name"] == "Condomínio Jardim Exemplo"
    assert row["scope_path"] == "/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo"
    assert row["email"] == "pessoa@exemplo.com.br"
    assert (row["contact_consent"], row["marketing_consent"]) == (True, True)
    csv = await api.get("/v1/admin/property-alerts", params={"format": "csv"}, headers=ADMIN)
    assert csv.text.startswith("id,scope,scope_name")

    deleted = await api.delete(f"/v1/admin/property-alerts/{row['id']}", headers=ADMIN)
    assert deleted.status_code == 204
    assert await _count(session) == 0
    assert await session.scalar(select(func.count()).select_from(PropertyAlertConsent)) == 0
