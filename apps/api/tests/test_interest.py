"""Public interest signups (CLAUDE.md rules 8, 11, 13)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.rate_limit import InMemoryRateLimiter
from app.core.settings import Settings
from app.domains.interest import service
from app.domains.interest.models import ConsentPurpose, InterestSignup, InterestStatus
from app.domains.interest.schemas import InterestSignupIn, normalize_br_phone
from app.integrations.registry import Integrations
from app.integrations.whatsapp.fake import FakeWhatsApp
from app.main import create_app

ADMIN_TOKEN = "test-admin-token"

AUCTION: dict[str, Any] = {
    "kind": "auction",
    "name": "Carla Souza",
    "phone": "(11) 92740-8912",
    "consents": {"contact_about_properties": True, "marketing": False},
    "utm": {"source": "instagram", "medium": "cpc", "campaign": "leilao-sp"},
    "source_page": "/leilao",
    "criteria": {
        "regions": "São Paulo · Zona Sul",
        "property_kinds": ["apartment", "house"],
        "price_range": "300k_to_600k",
        "payment": "financing",
        "purpose": "live",
        "has_participated": False,
    },
}


@pytest.fixture
async def api(session: AsyncSession, integrations: Integrations) -> AsyncIterator[AsyncClient]:
    settings = Settings(admin_token=ADMIN_TOKEN, interest_rate_limit_per_minute=5)
    app = create_app(
        settings=settings, integrations=integrations, rate_limiter=InMemoryRateLimiter()
    )

    async def _session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _session
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def _whatsapp(integrations: Integrations) -> FakeWhatsApp:
    assert isinstance(integrations.whatsapp, FakeWhatsApp)
    return integrations.whatsapp


# ------------------------------------------------------------------ schemas


@pytest.mark.parametrize(
    ("raw", "e164"),
    [
        ("(11) 92740-8912", "+5511927408912"),
        ("+55 11 3265-1234", "+551132651234"),
        ("11927408912", "+5511927408912"),
    ],
)
def test_phone_normalization(raw: str, e164: str) -> None:
    assert normalize_br_phone(raw) == e164


@pytest.mark.parametrize("raw", ["123", "0800 123 4567", "+1 415 555 0100x"])
def test_phone_rejects_invalid(raw: str) -> None:
    with pytest.raises(ValueError, match="invalid_phone"):
        normalize_br_phone(raw)


ADAPTER: TypeAdapter[Any] = TypeAdapter(InterestSignupIn)


@pytest.mark.parametrize(
    ("kind", "criteria"),
    [
        ("agency", {"company": "Imobiliária Sul", "brokers_count": 12}),
        (
            "owner_listing",
            {
                "transaction": "sale",
                "cep": "04014-000",
                "property_kind": "apartment",
                "bedrooms": 2,
            },
        ),
        (
            "developer",
            {"company": "Construtora X", "cities": ["São Paulo"], "launches_per_year": 3},
        ),
        (
            "investor_institutional",
            {
                "company": "Gestora Y",
                "org_type": "fii_manager",
                "portfolio_size": "51_to_200",
                "cities": ["São Paulo"],
                "interests": ["operations", "data"],
            },
        ),
        ("rental_admin", {"city": "São Paulo", "properties_count": 2}),
        ("auction", AUCTION["criteria"]),
    ],
)
def test_criteria_schema_per_kind(kind: str, criteria: dict[str, Any]) -> None:
    parsed = ADAPTER.validate_python({**AUCTION, "kind": kind, "criteria": criteria})
    assert parsed.kind == kind


def test_criteria_of_another_kind_is_rejected() -> None:
    with pytest.raises(ValidationError):
        ADAPTER.validate_python({**AUCTION, "kind": "developer"})


def test_owner_cep_is_normalized_and_validated() -> None:
    owner = {
        **AUCTION,
        "kind": "owner_listing",
        "criteria": {"transaction": "rent", "cep": "04014-000", "property_kind": "house"},
    }
    assert ADAPTER.validate_python(owner).criteria.cep == "04014000"
    with pytest.raises(ValidationError):
        ADAPTER.validate_python({**owner, "criteria": {**owner["criteria"], "cep": "0401"}})


def test_unknown_criteria_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        ADAPTER.validate_python({**AUCTION, "criteria": {**AUCTION["criteria"], "discount": "50%"}})


# ------------------------------------------------------------------ endpoint


async def test_signup_is_stored_with_consents_and_opt_in_requested(
    api: AsyncClient, session: AsyncSession, integrations: Integrations
) -> None:
    response = await api.post("/v1/public/interest", json=AUCTION)
    assert response.status_code == 202
    assert response.json() == {"status": "accepted", "opt_in": "whatsapp_sent"}

    signup = (await session.scalars(select(InterestSignup))).one()
    assert signup.phone_e164 == "+5511927408912"
    assert signup.status is InterestStatus.PENDING_OPT_IN
    assert signup.opt_in_requested_at is not None
    assert (signup.utm_source, signup.utm_campaign, signup.source_page) == (
        "instagram",
        "leilao-sp",
        "/leilao",
    )
    consents = {c.purpose: c for c in signup.consents}
    assert consents[ConsentPurpose.CONTACT_ABOUT_PROPERTIES].granted is True
    assert consents[ConsentPurpose.MARKETING].granted is False
    assert all(c.source == "/leilao" and c.granted_at for c in signup.consents)

    # Before the person answers, the only message is the opt-in template.
    outbox = _whatsapp(integrations).outbox
    assert len(outbox) == 1
    assert outbox[0].template is not None and outbox[0].template.name == service.OPT_IN_TEMPLATE
    assert outbox[0].body is None


async def test_contact_consent_is_required(api: AsyncClient, session: AsyncSession) -> None:
    payload = {**AUCTION, "consents": {"contact_about_properties": False, "marketing": True}}
    response = await api.post("/v1/public/interest", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "consent_required"
    assert (await session.scalars(select(InterestSignup))).all() == []


async def test_honeypot_is_accepted_but_not_stored(
    api: AsyncClient, session: AsyncSession, integrations: Integrations
) -> None:
    response = await api.post(
        "/v1/public/interest", json={**AUCTION, "website": "http://spam.example"}
    )
    assert response.status_code == 202
    assert response.json()["opt_in"] == "not_requested"
    assert (await session.scalars(select(InterestSignup))).all() == []
    assert _whatsapp(integrations).outbox == []


async def test_rate_limit_per_client_and_kind(api: AsyncClient) -> None:
    for _ in range(5):
        assert (await api.post("/v1/public/interest", json=AUCTION)).status_code == 202
    blocked = await api.post("/v1/public/interest", json=AUCTION)
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"
    other_kind = {**AUCTION, "kind": "rental_admin", "criteria": {"city": "São Paulo"}}
    assert (await api.post("/v1/public/interest", json=other_kind)).status_code == 202


async def test_invalid_phone_message_is_pt_br(api: AsyncClient) -> None:
    response = await api.post("/v1/public/interest", json={**AUCTION, "phone": "123"})
    assert response.status_code == 422
    field = response.json()["error"]["fields"][0]
    assert field["path"] == ["phone"]
    assert field["message"].startswith("Confira o WhatsApp")


async def test_opt_in_reply_confirms_or_unsubscribes(
    api: AsyncClient, session: AsyncSession
) -> None:
    await api.post("/v1/public/interest", json=AUCTION)
    assert await service.handle_whatsapp_reply(session, "+5511927408912", "oi") == 0
    assert await service.handle_whatsapp_reply(session, "+5511927408912", " sim ") == 1
    signup = (await session.scalars(select(InterestSignup))).one()
    assert signup.status is InterestStatus.CONFIRMED
    assert signup.opt_in_confirmed_at is not None
    assert await service.handle_whatsapp_reply(session, "+5511927408912", "SAIR") == 1
    assert signup.status is InterestStatus.UNSUBSCRIBED


async def test_admin_requires_token(api: AsyncClient) -> None:
    assert (await api.get("/v1/admin/interest")).status_code == 401
    assert (
        await api.get("/v1/admin/interest", headers={"X-Admin-Token": "wrong"})
    ).status_code == 401


async def test_admin_lists_filters_and_exports_csv(api: AsyncClient) -> None:
    await api.post("/v1/public/interest", json=AUCTION)
    developer = {
        **AUCTION,
        "kind": "developer",
        "criteria": {"company": "Construtora X", "cities": ["São Paulo"]},
    }
    await api.post("/v1/public/interest", json=developer)
    headers = {"X-Admin-Token": ADMIN_TOKEN}

    listed = await api.get("/v1/admin/interest", params={"kind": "auction"}, headers=headers)
    assert listed.status_code == 200
    assert [row["kind"] for row in listed.json()] == ["auction"]

    exported = await api.get("/v1/admin/interest", params={"format": "csv"}, headers=headers)
    assert exported.headers["content-type"].startswith("text/csv")
    lines = exported.text.strip().splitlines()
    assert lines[0].startswith("id,created_at,kind,status")
    assert len(lines) == 3
