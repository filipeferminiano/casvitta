"""BO2 CRECI verification: queue (oldest first), SLA, checklist, decisions, audit, email."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import AuditLog, BrokerProfile, CreciReviewStatus
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import (
    add_broker,
    make_client,
    outbox,
    signed_in_as,
    staff_settings,
)

ALL_CHECKED = {
    "checklist": {
        "number_exists": True,
        "name_matches": True,
        "active": True,
        "kind_matches": True,
    }
}


@pytest.fixture
async def api(make_session, integrations: Integrations) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with make_client(make_session, integrations, staff_settings()) as client:
        yield client


async def _pending(session: AsyncSession, name: str, hours_ago: int) -> BrokerProfile:
    profile = await add_broker(session, name, submitted_at=utcnow() - timedelta(hours=hours_ago))
    with cross_tenant(session):
        profile.creci_review_status = CreciReviewStatus.PENDING
        await session.commit()
    return profile


async def test_queue_is_oldest_first_with_sla_and_counts(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _pending(session, "Carla Mendes", 6)
    await _pending(session, "Ana Ribeiro", 26)
    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)  # every role reads
    body = (await api.get("/v1/staff/creci")).json()
    assert [i["display_name"] for i in body["items"]] == ["Ana Ribeiro", "Carla Mendes"]
    ana, carla = body["items"]
    assert ana["over_sla"] is True and ana["waiting_hours"] >= 26
    assert carla["over_sla"] is False
    assert ana["email"].endswith("@…") and ana["creci_number"] == "123.456-F"
    assert ana["lookup_url"] == "https://www.crecisp.gov.br/"
    assert body["counts"]["pending"] == 2 and body["counts"]["verified"] == 0
    assert body["sla_hours"] == 24


async def test_approve_needs_every_check_and_the_permission(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await _pending(session, "Ana Ribeiro", 2)
    url = f"/v1/staff/creci/{ana.id}/approve"

    await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    assert (await api.post(url, json=ALL_CHECKED)).status_code == 403

    staff = await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    partial = {"checklist": {**ALL_CHECKED["checklist"], "active": False}}
    r = await api.post(url, json=partial)
    assert r.status_code == 422 and r.json()["error"]["code"] == "checklist_incomplete"

    r = await api.post(url, json=ALL_CHECKED)
    assert r.status_code == 200 and r.json()["status"] == "verified"
    with cross_tenant(session):
        await session.refresh(ana)
    assert ana.creci_verified_at is not None and ana.creci_reviewed_by_id == staff.id
    # Twice is refused: the state moved on.
    assert (await api.post(url, json=ALL_CHECKED)).status_code == 409

    entry = await session.scalar(select(AuditLog).where(AuditLog.action == "creci.verified"))
    assert entry is not None and entry.actor_staff_id == staff.id
    assert entry.details["checklist"]["name_matches"] is True
    assert "verificado" in outbox(integrations).outbox[-1].subject


async def test_correction_goes_to_the_broker_and_comes_back_as_resubmitted(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await _pending(session, "Ana Ribeiro", 2)
    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    reason = "O número informado é de outra pessoa no CRECI-SP."
    r = await api.post(f"/v1/staff/creci/{ana.id}/request-correction", json={"reason": reason})
    assert r.status_code == 200 and r.json()["status"] == "correction_requested"
    mail = outbox(integrations).outbox[-1]
    assert reason in mail.text and "Configurações" in mail.text
    assert (await api.get("/v1/staff/creci")).json()["counts"]["correction_requested"] == 1

    # The broker sends a new number: back in the pending queue, marked as a correction.
    from app.domains.accounts.schemas import BrokerProfileUpdate  # noqa: PLC0415
    from app.domains.accounts.service import update_broker_profile  # noqa: PLC0415

    user_id = ana.user_id
    session.expire_all()  # the API changed the row in another session
    with cross_tenant(session):
        out = await update_broker_profile(
            session, user_id, BrokerProfileUpdate(creci_number="654.321")
        )
        await session.commit()
    assert out.creci_review_status is CreciReviewStatus.PENDING
    pending = (await api.get("/v1/staff/creci")).json()["items"]
    assert pending[0]["resubmitted"] is True and pending[0]["reason"] == reason


async def test_reject_needs_a_reason_and_is_audited(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await _pending(session, "Ana Ribeiro", 2)
    staff = await signed_in_as(api, integrations, session, StaffRole.ADMIN)
    url = f"/v1/staff/creci/{ana.id}/reject"
    assert (await api.post(url, json={"reason": ""})).status_code == 422
    r = await api.post(url, json={"reason": "Inscrição cancelada no conselho."})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    rejected = (await api.get("/v1/staff/creci", params={"status": "rejected"})).json()
    assert [i["id"] for i in rejected["items"]] == [str(ana.id)]
    entry = await session.scalar(select(AuditLog).where(AuditLog.action == "creci.rejected"))
    assert entry is not None and entry.actor_staff_id == staff.id
    assert entry.reason == "Inscrição cancelada no conselho."


async def test_broker_sees_the_reason_in_the_app(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    from app.domains.accounts.service import broker_out  # noqa: PLC0415

    ana = await _pending(session, "Ana Ribeiro", 2)
    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    await api.post(
        f"/v1/staff/creci/{ana.id}/request-correction",
        json={"reason": "Envie o número com 6 dígitos."},
    )
    with cross_tenant(session):
        await session.refresh(ana)
    out = broker_out(ana)
    assert out.creci_status == "pending"  # never publishable until verified
    assert out.creci_review_reason == "Envie o número com 6 dígitos."
