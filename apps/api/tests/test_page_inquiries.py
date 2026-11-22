"""SOC-1b: forms on the broker page land in the broker's CRM (Interessados), with consent (LGPD),
the source and only what the person typed. Grátis pages have no forms."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.core.tenancy import cross_tenant
from app.domains.accounts.models import BrokerProfile, Plan, Workspace
from app.domains.contacts.models import Consent, ContactNote, Person
from app.domains.leads.models import Lead
from app.domains.pages import inquiries
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client
from tests.test_pages import BROWSER, SETTINGS, _whatsapp
from tests.test_properties import _cookie

CONSENT = "Aceito ser contatado pela Mariana sobre imóveis"


async def _page(make_session, plan: Plan = Plan.ESSENTIAL) -> BrokerProfile:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    async with make_session() as s:
        with cross_tenant(s):
            workspace = await s.get(Workspace, broker.workspace_id)
            assert workspace is not None
            workspace.plan = plan
            await s.commit()
    return broker


def _finder(**extra: Any) -> dict[str, Any]:
    return {
        "kind": "finder",
        "purpose": "buy",
        "name": "Lucas",
        "phone": "(19) 98123-4567",
        "consent": True,
        "consent_text": CONSENT,
        "page_url": "https://mariana.casvitta.com.br",
        "source": "qr",
        "neighborhoods": ["Cambuí", "Taquaral"],
        "property_kinds": ["apartment"],
        "min_price_cents": 60_000_000,
        "max_price_cents": 90_000_000,
        "min_bedrooms": 2,
        "matched_codes": ["CV-204", "bad"],
        **extra,
    }


async def test_finder_request_becomes_a_crm_contact_with_consent(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    broker = await _page(make_session)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        assert (await api.post("/v1/page/publish", headers=h)).status_code == 200
        public = (await api.get(f"/v1/public/pages/{broker.slug}")).json()
        assert public["forms"] is True
        url = f"/v1/public/pages/{broker.slug}/inquiries"
        r = await api.post(url, json=_finder(), headers=BROWSER)
        assert r.status_code == 201, r.text

        listed = (await api.get("/v1/contacts?view=page", headers=h)).json()
        assert listed["counts"]["page"] == 1
        [row] = listed["items"]
        assert row["source"] == "finder" and row["kind"] == "buyer"
        assert row["source_detail"] == "Página · QR code"
        assert row["interest"]["neighborhoods"] == ["Cambuí", "Taquaral"]
        assert row["consent"]["whatsapp"] == "granted" and row["consent"]["email"] == "none"
        assert (await api.get("/v1/page/stats", headers=h)).json()["forms_submitted"] == 1

        # Sending again merges into the same person (phone), never a duplicate.
        await api.post(url, json=_finder(name="Lucas S."), headers=BROWSER)
        assert (await api.get("/v1/contacts?view=page", headers=h)).json()["counts"]["page"] == 1

    async with make_session() as s:
        with cross_tenant(s):
            mine = Person.workspace_id == broker.workspace_id
            person = await s.scalar(select(Person).where(mine))
            assert person is not None and person.phone_e164 == "+5519981234567"
            consent = await s.scalar(select(Consent).where(Consent.person_id == person.id))
            assert consent is not None and consent.proof_text == CONSENT
            note = await s.scalar(select(ContactNote).where(ContactNote.person_id == person.id))
            assert note is not None and note.author_user_id is None
            assert "CV-204" in note.body and "bad" not in note.body
            assert "R$ 600.000 a R$ 900.000" in note.body
            leads = (await s.scalars(select(Lead).where(Lead.person_id == person.id))).all()
            assert len(leads) == 1 and leads[0].source == "finder"


async def test_owner_form_is_separate_from_buyers(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    broker = await _page(make_session)
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        await api.post("/v1/page/publish", headers=h)
        r = await api.post(
            f"/v1/public/pages/{broker.slug}/inquiries",
            json={
                "kind": "owner",
                "purpose": "sell",
                "name": "Helena",
                "email": "helena@exemplo.com.br",
                "contact_preference": "email",
                "consent": True,
                "consent_text": CONSENT,
                "page_url": "https://mariana.casvitta.com.br",
                "city": "Campinas",
                "neighborhoods": ["Taquaral"],
                "property_kinds": ["apartment"],
                "details": "3 quartos, 92 m²",
            },
            headers=BROWSER,
        )
        assert r.status_code == 201, r.text
        listed = (await api.get("/v1/contacts?view=owners", headers=h)).json()
        [row] = listed["items"]
        assert row["source"] == "owner_form" and row["kind"] == "owner"
        assert row["consent"]["email"] == "granted"
        assert (await api.get("/v1/contacts?view=buyers", headers=h)).json()["items"] == []
        detail = (await api.get(f"/v1/contacts/{row['id']}", headers=h)).json()
        notes = [t["text"] for t in detail["timeline"] if t["kind"] == "note"]
        assert any("Detalhes: 3 quartos, 92 m²" in n for n in notes)
        assert any("Prefere contato por e-mail." in n for n in notes)


async def test_forms_need_consent_contact_and_a_plan_with_forms(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    free = await _page(make_session, Plan.FREE)
    paid = await _page(make_session)
    async with make_client(make_session, integrations, SETTINGS) as api:
        for broker in (free, paid):
            await api.post("/v1/page/publish", headers=_cookie(broker))
        assert (await api.get(f"/v1/public/pages/{free.slug}")).json()["forms"] is False
        r = await api.post(f"/v1/public/pages/{free.slug}/inquiries", json=_finder())
        assert r.status_code == 403

        url = f"/v1/public/pages/{paid.slug}/inquiries"
        for bad in (
            _finder(consent=False),
            _finder(phone=None),
            _finder(purpose="sell"),  # the finder is for buyers and tenants
            _finder(contact_preference="email"),  # no email given
        ):
            assert (await api.post(url, json=bad)).status_code == 422
        nobody = await api.post("/v1/public/pages/nobody/inquiries", json=_finder())
        assert nobody.status_code == 404


def test_summary_only_has_what_was_answered() -> None:
    data = inquiries.PageInquiryIn.model_validate(
        _finder(property_kinds=[], min_price_cents=None, min_bedrooms=None, matched_codes=[])
    )
    text = inquiries.summary(data)
    assert text.splitlines()[1] == "Comprar · Cambuí, Taquaral · até R$ 900.000."
    assert "quartos" not in text and "combinaram" not in text
