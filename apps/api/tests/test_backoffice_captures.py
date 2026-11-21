"""BO3 captures: masked lists, audited reveals, referrals to verified brokers (24 h), exports."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.domains.accounts.models import AuditLog
from app.domains.interest.models import (
    AssignmentOutcome,
    InterestAssignment,
    InterestKind,
    InterestSignup,
    InterestStatus,
)
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import (
    add_broker,
    add_capture,
    make_client,
    outbox,
    signed_in_as,
    staff_settings,
)

ACCEPT_LINK = re.compile(r"/corretor/aceitar-pedido#t=([\w-]+)")
OWNER = {
    "transaction": "sale",
    "cep": "04010100",
    "property_kind": "apartment",
    "bedrooms": 2,
    "area_m2": 68,
}


@pytest.fixture
async def api(make_session, integrations: Integrations) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with make_client(make_session, integrations, staff_settings()) as client:
        yield client


async def _actions(session: AsyncSession, action: str) -> list[AuditLog]:
    return list((await session.scalars(select(AuditLog).where(AuditLog.action == action))).all())


async def test_list_masks_contacts_and_filters(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", criteria=OWNER)
    await add_capture(
        session,
        InterestKind.OWNER_LISTING,
        "Otávio Silva",
        phone="+5511900001140",
        status=InterestStatus.PENDING_OPT_IN,
        criteria={**OWNER, "cep": "05010000"},
    )
    await add_capture(session, InterestKind.AUCTION, "Leilão Pessoa")
    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)

    body = (await api.get("/v1/staff/captures", params={"kind": "owner_listing"})).json()
    assert body["counts"]["owner_listing"] == 2 and body["counts"]["auction"] == 1
    paulo = next(i for i in body["items"] if i["name"] == "Paulo Mendes")
    assert paulo["phone"] == "(11) 9····-··12"
    assert paulo["email"] == "paulo@…"
    assert paulo["region"] == "CEP 04010-100" and paulo["state"] == "no_broker"

    confirmed = (
        await api.get("/v1/staff/captures", params={"kind": "owner_listing", "opt_in": "confirmed"})
    ).json()
    assert [i["name"] for i in confirmed["items"]] == ["Paulo Mendes"]
    by_region = (
        await api.get("/v1/staff/captures", params={"kind": "owner_listing", "region": "05010"})
    ).json()
    assert [i["name"] for i in by_region["items"]] == ["Otávio Silva"]
    direct = (
        await api.get("/v1/staff/captures", params={"kind": "owner_listing", "origin": "direct"})
    ).json()
    assert len(direct["items"]) == 2


async def test_revealing_a_contact_needs_permission_reason_and_is_audited(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    paulo = await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", criteria=OWNER)
    url = f"/v1/staff/captures/{paulo.id}/reveal"
    body = {"field": "phone", "reason": "retorno comercial"}

    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)
    assert (await api.post(url, json=body)).status_code == 403

    staff = await signed_in_as(api, integrations, session, StaffRole.FINANCE)
    assert (await api.post(url, json={"field": "phone", "reason": ""})).status_code == 422
    r = await api.post(url, json=body)
    assert r.status_code == 200 and r.json() == {"field": "phone", "value": "+5511927408912"}

    [entry] = await _actions(session, "contact.revealed")
    assert entry.actor_staff_id == staff.id and entry.reason == "retorno comercial"
    assert entry.details["field"] == "phone" and entry.details["person"] == "Paulo M."


async def test_opening_a_request_is_audited(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    paulo = await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", criteria=OWNER)
    await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    r = await api.get(f"/v1/staff/captures/{paulo.id}")
    assert r.status_code == 200 and r.json()["phone"].endswith("12")
    assert len(await _actions(session, "interest.viewed")) == 1


async def test_referral_only_to_verified_brokers_with_consent(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    paulo = await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", criteria=OWNER)
    silent = await add_capture(
        session, InterestKind.OWNER_LISTING, "Sem Consentimento", criteria=OWNER, consent=False
    )
    pending = await add_broker(session, "Rafael Souza")  # CRECI not verified
    ana = await add_broker(session, "Ana Ribeiro", verified=True, regions=["Vila Mariana"])
    bianca = await add_broker(session, "Bianca Lopes", verified=True, regions=["Zona Sul"])

    await signed_in_as(api, integrations, session, StaffRole.FINANCE)  # no captures.handle
    url = f"/v1/staff/captures/{paulo.id}/assign"
    assert (await api.post(url, json={"broker_profile_id": str(ana.id)})).status_code == 403

    staff = await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    candidates = (await api.get(f"/v1/staff/captures/{paulo.id}/candidates")).json()
    assert {c["name"] for c in candidates} == {"Ana Ribeiro", "Bianca Lopes"}

    r = await api.post(url, json={"broker_profile_id": str(pending.id)})
    assert r.status_code == 409 and r.json()["error"]["code"] == "broker_not_verified"
    r = await api.post(
        f"/v1/staff/captures/{silent.id}/assign", json={"broker_profile_id": str(ana.id)}
    )
    assert r.json()["error"]["code"] == "no_contact_consent"

    r = await api.post(url, json={"broker_profile_id": str(ana.id)})
    assert r.status_code == 200
    assert r.json()["state"] == "referred" and r.json()["broker_name"] == "Ana Ribeiro"
    offer = outbox(integrations).outbox[-1]
    # The broker sees what and where, not the owner's contact, until accepting.
    assert "Apartamento" in offer.text and "927408912" not in offer.text
    assert ACCEPT_LINK.search(offer.text)

    # Ana now has one open referral: Bianca comes first for the next one.
    other = await add_capture(session, InterestKind.OWNER_LISTING, "Lúcia F.", criteria=OWNER)
    ordered = (await api.get(f"/v1/staff/captures/{other.id}/candidates")).json()
    assert [c["name"] for c in ordered][:1] == ["Bianca Lopes"]

    # Pointing Paulo to Bianca withdraws Ana's referral.
    await api.post(url, json={"broker_profile_id": str(bianca.id)})
    outcomes = sorted(
        a.outcome
        for a in (
            await session.scalars(
                select(InterestAssignment).where(InterestAssignment.signup_id == paulo.id)
            )
        ).all()
    )
    assert outcomes == [AssignmentOutcome.OPEN, AssignmentOutcome.WITHDRAWN]
    entries = await _actions(session, "interest.assigned")
    assert [e.details["broker"] for e in entries] == ["Ana Ribeiro", "Bianca Lopes"]
    assert all(e.actor_staff_id == staff.id for e in entries)


async def test_broker_accepts_and_gets_the_contact(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    paulo = await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", criteria=OWNER)
    ana = await add_broker(session, "Ana Ribeiro", verified=True)
    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    await api.post(f"/v1/staff/captures/{paulo.id}/assign", json={"broker_profile_id": str(ana.id)})
    match = ACCEPT_LINK.search(outbox(integrations).outbox[-1].text)
    assert match
    api.cookies.clear()  # the link works without any session
    r = await api.post("/v1/public/capture-assignments/accept", json={"token": match.group(1)})
    assert r.status_code == 200 and r.json() == {"status": "accepted"}
    contact = outbox(integrations).outbox[-1]
    assert "+5511927408912" in contact.text and "Paulo Mendes" in contact.text
    again = await api.post("/v1/public/capture-assignments/accept", json={"token": match.group(1)})
    assert again.json() == {"status": "accepted"}
    assert len(await _actions(session, "interest.accepted")) == 1


async def test_unanswered_referral_goes_back_to_the_queue(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    paulo = await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", criteria=OWNER)
    ana = await add_broker(session, "Ana Ribeiro", verified=True)
    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    await api.post(f"/v1/staff/captures/{paulo.id}/assign", json={"broker_profile_id": str(ana.id)})
    match = ACCEPT_LINK.search(outbox(integrations).outbox[-1].text)
    assert match
    past = utcnow() - timedelta(minutes=1)
    await session.execute(update(InterestAssignment).values(expires_at=past))
    await session.commit()

    body = (await api.get("/v1/staff/captures", params={"kind": "owner_listing"})).json()
    assert body["items"][0]["state"] == "no_broker"
    [expired] = await _actions(session, "interest.assignment_expired")
    assert expired.actor == "system"
    # The old link no longer gives the contact.
    r = await api.post("/v1/public/capture-assignments/accept", json={"token": match.group(1)})
    assert r.json() == {"status": "expired"}
    overview = (await api.get("/v1/staff/overview")).json()
    assert next(q for q in overview["queue"] if q["key"] == "owner_requests")["count"] == 1


async def test_export_only_opted_in_with_permission_and_audit(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await add_capture(session, InterestKind.AUCTION, "Confirmada", criteria={"regions": "Zona Sul"})
    await add_capture(
        session, InterestKind.AUCTION, "Sem Opt-in", status=InterestStatus.PENDING_OPT_IN
    )
    await add_capture(session, InterestKind.AUCTION, "Sem Consentimento", consent=False)

    await signed_in_as(api, integrations, session, StaffRole.FINANCE)
    assert (
        await api.get("/v1/staff/captures/export", params={"kind": "auction"})
    ).status_code == 403

    staff = await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    r = await api.get("/v1/staff/captures/export", params={"kind": "auction"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("data,tipo,nome,telefone") and len(lines) == 2
    assert "Confirmada" in lines[1] and "+5511927408912" in lines[1]
    [entry] = await _actions(session, "interest.exported")
    assert entry.actor_staff_id == staff.id and entry.details["count"] == 1


async def test_other_kinds_are_marked_handled(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    investor = await add_capture(
        session, InterestKind.INVESTOR_INSTITUTIONAL, "Gestora X", criteria={"cities": ["SP"]}
    )
    owner = await add_capture(session, InterestKind.OWNER_LISTING, criteria=OWNER)
    await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    r = await api.post(f"/v1/staff/captures/{investor.id}/handled", json={"handled": True})
    assert r.status_code == 200 and r.json()["state"] == "handled"
    r = await api.post(f"/v1/staff/captures/{owner.id}/handled", json={"handled": True})
    assert r.status_code == 409
    overview = (await api.get("/v1/staff/overview")).json()
    waiting = next(q for q in overview["queue"] if q["key"] == "institutional_investors")
    assert waiting["count"] == 0


async def test_demo_captures_are_listed_but_never_counted(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    demo = await add_capture(session, InterestKind.AUCTION, "Demo")
    demo.is_demo = True
    await session.commit()
    await signed_in_as(api, integrations, session, StaffRole.ADMIN)
    listed = (await api.get("/v1/staff/captures", params={"kind": "auction"})).json()
    assert listed["items"][0]["is_demo"] is True
    overview = (await api.get("/v1/staff/overview")).json()
    assert overview["tiles"]["captures_7d"] == 0


async def test_unknown_request_is_404(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await signed_in_as(api, integrations, session, StaffRole.ADMIN)
    r = await api.get("/v1/staff/captures/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert await session.scalar(select(InterestSignup)) is None
