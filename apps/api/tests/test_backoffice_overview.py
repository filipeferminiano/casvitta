"""BO1 overview and global search: real numbers only, masked contacts, audited search."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.domains.accounts.models import AuditLog
from app.domains.interest.models import InterestKind, InterestStatus
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import (
    add_broker,
    add_capture,
    make_client,
    signed_in_as,
    staff_settings,
)


@pytest.fixture
async def api(make_session, integrations: Integrations) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with make_client(make_session, integrations, staff_settings()) as client:
        yield client


async def test_overview_counts_only_real_records(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    old = utcnow() - timedelta(hours=30)
    await add_broker(session, "Ana Ribeiro", submitted_at=old)  # pending, over SLA
    await add_broker(session, "Rafael Souza")  # pending, recent
    await add_broker(session, "Bianca Lopes", verified=True)
    await add_broker(session, "Sem Creci", creci=None)
    await add_broker(session, "Demo", is_demo=True)  # never counted
    await add_capture(session, InterestKind.AUCTION)
    await add_capture(session, InterestKind.AUCTION, status=InterestStatus.PENDING_OPT_IN)
    await add_capture(session, InterestKind.OWNER_LISTING)
    await add_capture(session, InterestKind.INVESTOR_INSTITUTIONAL)
    await add_capture(
        session, InterestKind.DEVELOPER, created_at=utcnow() - timedelta(days=10)
    )  # outside the 7 days

    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    body = (await api.get("/v1/staff/overview")).json()
    assert body["tiles"] == {
        "brokers_total": 4,
        "brokers_this_week": 4,
        "creci_pending": 2,
        "creci_pending_over_sla": 1,
        "captures_7d": 4,
        "captures_7d_auction": 2,
    }
    # No tiles for data the product does not have yet.
    assert set(body) == {"tiles", "queue", "captures", "funnel", "activity", "creci_sla_hours"}
    queue = {q["key"]: q for q in body["queue"]}
    assert queue["creci"] == {"key": "creci", "count": 2, "over_sla": 1}
    assert queue["owner_requests"]["count"] == 1
    assert queue["institutional_investors"]["count"] == 1
    captures = {c["kind"]: c for c in body["captures"]}
    assert captures["auction"] == {
        "kind": "auction",
        "last_7d": 2,
        "confirmed_7d": 1,
        "open": None,
    }
    assert captures["owner_listing"]["open"] == 1
    assert captures["developer"]["last_7d"] == 0
    assert [(f["key"], f["count"]) for f in body["funnel"]] == [
        ("signed_up", 4),
        ("creci_sent", 3),
        ("creci_verified", 1),
    ]
    assert isinstance(body["activity"], list)


async def test_read_only_sees_the_overview_without_team_activity(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)
    body = (await api.get("/v1/staff/overview")).json()
    assert body["activity"] is None


async def test_customer_or_anonymous_requests_are_refused(api: AsyncClient) -> None:
    assert (await api.get("/v1/staff/overview")).status_code == 401
    assert (await api.get("/v1/staff/search", params={"q": "ana"})).status_code == 401


async def test_search_finds_accounts_people_and_creci_masked_and_audited(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await add_broker(session, "Ana Ribeiro", creci="000.123")
    await add_capture(session, InterestKind.OWNER_LISTING, "Paulo Mendes", phone="+5511912345678")
    staff = await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)

    by_name = (await api.get("/v1/staff/search", params={"q": "ribeiro"})).json()
    account = next(h for h in by_name["hits"] if h["kind"] == "account")
    assert account["title"] == "Ana Ribeiro" and account["subtitle"].endswith("@…")

    by_creci = (await api.get("/v1/staff/search", params={"q": "000.123"})).json()
    creci = next(h for h in by_creci["hits"] if h["kind"] == "creci")
    assert creci["subtitle"] == "CRECI-SP 000.123-F"

    by_phone = (await api.get("/v1/staff/search", params={"q": "(11) 91234-5678"})).json()
    person = next(h for h in by_phone["hits"] if h["kind"] == "person")
    assert person["title"] == "Paulo Mendes"
    assert "91234" not in person["subtitle"] and person["subtitle"].endswith("78")

    searches = (
        await session.scalars(select(AuditLog).where(AuditLog.action == "search.performed"))
    ).all()
    assert [s.details["query"] for s in searches] == ["ribeiro", "000.123", "(11) 91234-5678"]
    assert all(s.actor_staff_id == staff.id for s in searches)
    assert (await api.get("/v1/staff/search", params={"q": "a"})).status_code == 422


def test_every_capture_kind_has_a_place_on_screen() -> None:
    from app.domains.backoffice.service import KIND_ORDER  # noqa: PLC0415

    assert sorted(KIND_ORDER) == sorted(InterestKind)
