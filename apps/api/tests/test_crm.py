"""CRM-1: contacts, consent and SAIR, pipeline, inbox window, calendar conflicts, public contact."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import encode_access_token
from app.core.settings import Settings
from app.core.tenancy import bind_workspace, cross_tenant
from app.core.time import TZ, today_local
from app.domains.accounts.models import BrokerProfile, Plan, Workspace
from app.domains.activity.models import EventActor, KeyEvent, KeyEventKind, is_activity
from app.domains.appointments import service as calendar
from app.domains.contacts import consent as consent_rules
from app.domains.contacts import service as contacts
from app.domains.contacts.models import (
    Consent,
    ConsentPurpose,
    ConsentStatus,
    ContactSource,
    Person,
)
from app.domains.contacts.models import (
    ContactChannel as Channel,
)
from app.domains.contacts.schemas import ContactConsentIn, ContactIn
from app.domains.conversations import service as conversations
from app.domains.conversations.models import AiMode, ConversationChannel
from app.domains.leads import service as leads
from app.domains.listings.models import Channel as ListingChannel
from app.domains.properties import service as properties
from app.domains.properties.models import AuthorizationReview, PropertyMedia
from app.domains.properties.schemas import AuthorizationIn, PropertyIn, PropertyPatch
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client

SETTINGS = Settings(cookie_path_prefix="")


async def broker_session(make_session, plan: Plan = Plan.AUTOMATION, **kw: Any):  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, kw.pop("name", "Mariana Alves"), verified=True, **kw)
        with cross_tenant(setup):
            workspace = await setup.get(Workspace, broker.workspace_id)
            assert workspace is not None
            workspace.plan = plan
            await setup.commit()
    s: AsyncSession = make_session()
    bind_workspace(s, broker.workspace_id)
    return broker, s


def contact(**kw: Any) -> ContactIn:
    base: dict[str, Any] = {"name": "Lucas Martins", "phone": "(19) 98123-4567"}
    base.update(kw)
    return ContactIn(**base)


# ------------------------------------------------------------------ contacts


async def test_contacts_merge_by_phone_or_email_never_by_instagram(make_session) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session)
    first, created = await contacts.upsert_contact(s, contact(), user_id=broker.user_id)
    again, created_again = await contacts.upsert_contact(
        s, contact(name="Lucas", email="lucas@exemplo.com.br"), user_id=broker.user_id
    )
    assert created and not created_again and again.id == first.id
    assert again.email == "lucas@exemplo.com.br" and again.name == "Lucas Martins"  # fills, keeps
    by_email, _ = await contacts.upsert_contact(
        s, contact(name="L. M.", phone=None, email="lucas@exemplo.com.br")
    )
    assert by_email.id == first.id
    a, _ = await contacts.upsert_contact(s, contact(name="A", phone=None, instagram_handle="@x"))
    b, _ = await contacts.upsert_contact(s, contact(name="B", phone=None, instagram_handle="@x"))
    assert a.id != b.id  # an Instagram handle alone never merges
    await s.close()


async def test_contacts_are_confined_to_their_workspace(make_session) -> None:  # type: ignore[no-untyped-def]
    _, s1 = await broker_session(make_session, name="Ana")
    person, _ = await contacts.upsert_contact(s1, contact())
    await s1.commit()
    await s1.close()
    _, s2 = await broker_session(make_session, name="Bruno")
    assert (await contacts.list_contacts(s2)).items == []
    with pytest.raises(AppError):
        await contacts.contact_360(s2, person.id)
    # Same phone in another workspace is another contact.
    other, created = await contacts.upsert_contact(s2, contact())
    assert created and other.id != person.id
    await s2.close()


async def test_broker_limit_blocks_manual_contacts_but_never_inbound(make_session) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session, plan=Plan.FREE)
    s.add_all(Person(name=f"P{i}", source=ContactSource.MANUAL) for i in range(100))
    await s.flush()
    with pytest.raises(AppError) as exc:
        await contacts.upsert_contact(s, contact(), user_id=broker.user_id)
    assert exc.value.code == "contacts_limit_reached"
    person, created = await contacts.upsert_contact(s, contact(), actor=EventActor.CONTACT)
    assert created and person.id
    await s.close()


async def test_consent_needs_proof_and_sair_revokes_at_once(make_session) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(ValueError):
        ContactConsentIn(channel="whatsapp", purpose="marketing", granted=True, proof_source="form")
    _broker, s = await broker_session(make_session)
    granted = ContactConsentIn(
        channel=Channel.WHATSAPP,
        purpose=ConsentPurpose.MARKETING,
        granted=True,
        proof_source="form",
        proof_text="Aceito receber novidades de imóveis por WhatsApp.",
        proof_location="https://mariana.casvitta.com.br",
    )
    person, _ = await contacts.upsert_contact(
        s, contact(consents=[granted]), actor=EventActor.CONTACT
    )
    records = list((await s.scalars(select(Consent).where(Consent.person_id == person.id))).all())
    assert consent_rules.allows(records, Channel.WHATSAPP, ConsentPurpose.MARKETING)
    assert not consent_rules.allows(
        records, Channel.WHATSAPP, ConsentPurpose.CONTACT_ABOUT_PROPERTIES
    )
    assert records[0].proof_text and records[0].proof_location

    conversation = await conversations.get_or_open(s, person, ConversationChannel.WHATSAPP)
    for text in ("Sair", " SAIR! ", "parar"):
        assert consent_rules.is_opt_out(text)
    assert not consent_rules.is_opt_out("quero sair do aluguel")
    await conversations.record_inbound(s, conversation, "SAIR")
    records = list((await s.scalars(select(Consent).where(Consent.person_id == person.id))).all())
    assert not consent_rules.allows(records, Channel.WHATSAPP, ConsentPurpose.MARKETING)
    cur = consent_rules.current(records, Channel.WHATSAPP, ConsentPurpose.MARKETING)
    assert (
        cur.status == ConsentStatus.REVOKED and cur.record and cur.record.proof_source == "opt_out"
    )
    assert consent_rules.summary(records, Channel.WHATSAPP) == "revoked"
    await s.close()


# ------------------------------------------------------------------ pipeline and key events


async def test_default_stages_move_and_activity(make_session) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session)
    person, _ = await contacts.upsert_contact(s, contact(), user_id=broker.user_id)
    board = await leads.board(s)
    assert [c.stage.key for c in board] == [
        "new", "in_conversation", "visit_booked", "proposal", "won", "lost",
    ]  # fmt: skip
    assert board[0].cards[0].person_id == person.id
    lead_id = board[0].cards[0].lead_id
    await leads.move(s, lead_id, board[3].stage.id, user_id=broker.user_id)
    event = await s.scalar(select(KeyEvent).where(KeyEvent.kind == KeyEventKind.PIPELINE_MOVED))
    assert event is not None and event.is_activity
    assert not is_activity(KeyEventKind.PIPELINE_MOVED, EventActor.AGENT)  # agent alone ≠ activity
    with pytest.raises(AppError):
        await leads.update_stages(
            s, leads.StagesUpdate(stages=[leads.StageUpdateItem(id=board[0].stage.id)] * 2)
        )
    await s.close()


# ------------------------------------------------------------------ calendar

# A Monday at 08:00 in São Paulo.
MONDAY = datetime(2026, 11, 23, 8, 0, tzinfo=TZ)


def _rules(**kw: Any) -> calendar.SettingsOut:
    base: dict[str, Any] = {
        "visit_minutes": 45,
        "buffer_minutes": 30,
        "other_neighborhood_buffer_minutes": 30,
        "lead_time_minutes": 180,
        "days_ahead": 1,
        "weekly_hours": {"mon": [["09:00", "12:00"]], "tue": [["09:00", "10:00"]]},
        "neighborhoods_by_day": {},
    }
    base.update(kw)
    return calendar.SettingsOut(**base)


def test_free_slots_respect_lead_time_buffers_and_neighborhoods() -> None:
    slots = calendar.free_slots(_rules(), busy=[], now=MONDAY)
    starts = [s.starts_at.astimezone(TZ).strftime("%a %H:%M") for s in slots]
    assert starts[0] == "Mon 11:00"  # 3 h lead time from 08:00
    assert "Mon 11:15" in starts and "Mon 11:30" not in starts  # visit must end by 12:00
    # A visit 11:00–11:45 in Cambuí blocks 30 min around it, 60 min for another neighborhood.
    visit = (
        datetime(2026, 11, 24, 9, 0, tzinfo=TZ),
        datetime(2026, 11, 24, 9, 45, tzinfo=TZ),
        "Cambuí",
    )
    tue = calendar.free_slots(
        _rules(lead_time_minutes=0), busy=[visit], now=MONDAY, neighborhood="Cambuí"
    )
    assert not [s for s in tue if s.starts_at.date() == date(2026, 11, 24)]
    sat_only = _rules(lead_time_minutes=0, neighborhoods_by_day={"mon": ["Taquaral"]})
    assert calendar.free_slots(sat_only, busy=[], now=MONDAY, neighborhood="Cambuí")[
        0
    ].starts_at.date() == date(2026, 11, 24)


async def test_booking_rechecks_the_slot_at_commit(make_session) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session)
    person, _ = await contacts.upsert_contact(s, contact(), user_id=broker.user_id)
    other, _ = await contacts.upsert_contact(s, contact(name="Juliana", phone="11988887777"))
    slot = (await calendar.slots_for(s, broker.user_id, now=MONDAY.astimezone(UTC)))[0]
    visit = await calendar.book(
        s,
        broker.user_id,
        calendar.BookIn(person_id=person.id, starts_at=slot.starts_at),
        now=MONDAY,
    )
    assert visit.status == "confirmed"
    with pytest.raises(AppError) as exc:
        await calendar.book(
            s,
            broker.user_id,
            calendar.BookIn(person_id=other.id, starts_at=slot.starts_at),
            now=MONDAY,
        )
    assert exc.value.code == "slot_taken"
    board = await leads.board(s)
    booked = next(c for c in board if c.stage.key == "visit_booked")
    assert [card.person_id for card in booked.cards] == [person.id]
    await s.close()


# ------------------------------------------------------------------ inbox


async def test_reply_needs_an_open_window_and_is_idempotent(make_session) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session)
    person, _ = await contacts.upsert_contact(s, contact())
    conversation = await conversations.get_or_open(s, person, ConversationChannel.WHATSAPP)
    data = conversations.ReplyIn(body="Oi, Lucas!", idempotency_key="reply-0001")
    with pytest.raises(AppError) as exc:
        await conversations.reply(s, conversation.id, data, broker.user_id)
    assert exc.value.code == "reply_window_closed"
    conversation.ai_mode = AiMode.ACTIVE
    await conversations.record_inbound(s, conversation, "Ainda está disponível?")
    first = await conversations.reply(s, conversation.id, data, broker.user_id)
    second = await conversations.reply(s, conversation.id, data, broker.user_id)
    assert first.id == second.id and first.status == "queued"
    assert conversation.ai_mode == AiMode.PAUSED  # the broker took over
    inbox = await conversations.inbox(s)
    assert inbox[0].window_open and inbox[0].last_message == "Oi, Lucas!"
    await s.close()


# ------------------------------------------------------------------ public listing + contact


def _headers(broker: BrokerProfile) -> dict[str, str]:
    return {"cookie": f"cv_at={encode_access_token(SETTINGS, broker.user_id, broker.workspace_id)}"}


async def test_listing_page_contact_lands_in_the_broker_crm(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session)
    prop = await properties.create_property(
        s,
        PropertyIn(
            kind="apartment",
            transaction="sale",
            neighborhood="Cambuí",
            city="Campinas",
            state="SP",
            price_cents=78_000_000,
        ),
    )
    s.add_all(
        PropertyMedia(property_id=prop.id, storage_key=f"k{i}", url=f"u{i}", position=i)
        for i in range(5)
    )
    await properties.update_property(s, prop.id, PropertyPatch(status="active"))
    today = today_local()
    auth = await properties.add_authorization(
        s,
        prop.id,
        AuthorizationIn(
            kind="sale",
            evidence="attestation",
            attest=True,
            owner_name="Dona",
            signed_at=today - timedelta(days=1),
            expires_at=today + timedelta(days=60),
        ),
        broker.user_id,
    )
    auth.review_status = AuthorizationReview.VERIFIED  # checked by Casvitta (BO6)
    await properties.publish(s, prop.id, ListingChannel.MARKETPLACE)
    await s.commit()
    slug = properties.public_slug(prop)
    await s.close()

    body = {
        "name": "Lucas Martins",
        "phone": "(19) 98123-4567",
        "message": "Tem vaga coberta?",
        "consent_whatsapp": True,
        "consent_text": "Aceito receber contato sobre este imóvel por WhatsApp.",
        "page_url": f"https://casvitta.com.br/imovel/{slug}",
        "utm_source": "instagram",
    }  # fmt: skip
    api: AsyncClient
    async with make_client(make_session, integrations, SETTINGS) as api:
        page = await api.get(f"/v1/public/listings/{slug}")
        assert page.status_code == 200 and page.json()["broker"]["creci_number"] == "123.456"
        assert (await api.get("/v1/public/listings/qualquer-cv-999999")).status_code == 404
        no_consent = await api.post(
            f"/v1/public/listings/{slug}/contact", json={**body, "consent_whatsapp": False}
        )
        assert no_consent.status_code == 422
        r = await api.post(f"/v1/public/listings/{slug}/contact", json=body)
        assert r.status_code == 202, r.text

        listed = (await api.get("/v1/contacts", headers=_headers(broker))).json()
        row = listed["items"][0]
        assert row["name"] == "Lucas Martins" and row["source"] == "listing_page"
        assert row["source_detail"] == prop.code and row["consent"]["whatsapp"] == "granted"
        inbox = (await api.get("/v1/conversations", headers=_headers(broker))).json()
        assert inbox[0]["channel"] == "page" and inbox[0]["last_message"] == "Tem vaga coberta?"
        assert inbox[0]["window_open"] is False  # a form is not a chat
        detail = (await api.get(f"/v1/contacts/{row['id']}", headers=_headers(broker))).json()
        assert detail["leads"][0]["property_code"] == prop.code
        proof = next(c for c in detail["consents"] if c["channel"] == "whatsapp" and c["status"])
        assert proof["proof_source"] == "form" and proof["proof_location"].endswith(slug)


async def test_free_plan_has_no_pipeline_or_calendar(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    broker, s = await broker_session(make_session, plan=Plan.FREE)
    await s.close()
    async with make_client(make_session, integrations, SETTINGS) as api:
        r = await api.get("/v1/pipeline", headers=_headers(broker))
        assert r.status_code == 403 and r.json()["error"]["code"] == "feature_not_in_plan"
        assert (await api.get("/v1/calendar/slots", headers=_headers(broker))).status_code == 403
        assert (await api.get("/v1/contacts", headers=_headers(broker))).status_code == 200
        home = (await api.get("/v1/home", headers=_headers(broker))).json()
        assert home["steps"][0] == {"key": "creci", "done": True}
        assert home["next_step"] == "first_property"
