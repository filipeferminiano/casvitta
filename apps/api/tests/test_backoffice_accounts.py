"""BO4 accounts and BO5 360: filters, timeline, notes, publishing pause, view as customer."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import AuditLog, User, Workspace, WorkspaceKind
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client, signed_in_as, staff_settings


@pytest.fixture
async def api(make_session, integrations: Integrations) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with make_client(make_session, integrations, staff_settings()) as client:
        yield client


@pytest.fixture
async def app_client(make_session, integrations: Integrations) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    """A second browser: the customer app host."""
    async with make_client(make_session, integrations, staff_settings()) as client:
        yield client


async def _actions(session: AsyncSession, action: str) -> list[AuditLog]:
    return list((await session.scalars(select(AuditLog).where(AuditLog.action == action))).all())


async def test_list_shows_what_exists_with_filters(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await add_broker(session, "Ana Ribeiro", verified=True, regions=["Vila Mariana"])
    await add_broker(session, "Rafael Souza")  # CRECI pending, never signed in
    with cross_tenant(session):
        user = await session.get(User, ana.user_id)
        assert user is not None
        user.last_seen_at = utcnow() - timedelta(hours=2)
        workspace = await session.get(Workspace, ana.workspace_id)
        assert workspace is not None
        workspace.kind = WorkspaceKind.AGENCY
        await session.commit()

    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)
    body = (await api.get("/v1/staff/accounts")).json()
    rows = {r["name"]: r for r in body["items"]}
    assert (
        rows["Ana Ribeiro"]["creci"] == "verified" and rows["Ana Ribeiro"]["city"] == "Vila Mariana"
    )
    assert rows["Ana Ribeiro"]["last_access_at"] is not None
    assert (
        rows["Rafael Souza"]["creci"] == "pending"
        and rows["Rafael Souza"]["last_access_at"] is None
    )
    # Subscription, properties, leads and health are not in the database yet: not in the response.
    assert not {"subscription", "properties", "leads_30d", "health"} & set(rows["Ana Ribeiro"])
    assert body["counts"] == {
        "all": 2,
        "agencies": 1,
        "creci_pending": 1,
        "no_access": 1,
        "paused": 0,
    }
    pending = (await api.get("/v1/staff/accounts", params={"view": "creci_pending"})).json()
    assert [r["name"] for r in pending["items"]] == ["Rafael Souza"]


async def test_360_timeline_notes_and_audit(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await add_broker(session, "Ana Ribeiro")
    await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    await api.post(
        f"/v1/staff/creci/{ana.id}/approve",
        json={
            "checklist": {
                "number_exists": True,
                "name_matches": True,
                "active": True,
                "kind_matches": True,
            }
        },
    )
    url = f"/v1/staff/accounts/{ana.workspace_id}"
    r = await api.post(f"{url}/notes", json={"body": "Liguei em 20/11: vai trocar o cartão."})
    assert r.status_code == 201
    body = (await api.get(url)).json()
    assert body["team"][0]["creci"] == "verified"
    assert [t["action"] for t in body["timeline"]][:2] == ["account.note_added", "creci.verified"]
    assert body["notes"][0]["body"].startswith("Liguei")
    assert len(await _actions(session, "account.viewed")) == 1

    await signed_in_as(api, integrations, session, StaffRole.READ_ONLY)
    assert (await api.post(f"{url}/notes", json={"body": "oi"})).status_code == 403


async def test_pausing_publications_needs_permission_reason_and_is_audited(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await add_broker(session, "Ana Ribeiro", verified=True)
    url = f"/v1/staff/accounts/{ana.workspace_id}/pause-publishing"
    await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    assert (await api.post(url, json={"reason": "Autorização vencida"})).status_code == 403

    staff = await signed_in_as(api, integrations, session, StaffRole.OPERATIONS)
    assert (await api.post(url, json={"reason": ""})).status_code == 422
    assert (await api.post(url, json={"reason": "Autorização vencida"})).status_code == 204
    body = (await api.get(f"/v1/staff/accounts/{ana.workspace_id}")).json()
    assert body["publishing_paused_reason"] == "Autorização vencida"
    [entry] = await _actions(session, "account.publishing_paused")
    assert entry.actor_staff_id == staff.id and entry.reason == "Autorização vencida"
    r = await api.post(
        f"/v1/staff/accounts/{ana.workspace_id}/resume-publishing",
        json={"reason": "Autorização renovada"},
    )
    assert r.status_code == 204


async def test_view_as_opens_a_read_only_session(
    api: AsyncClient,
    app_client: AsyncClient,
    integrations: Integrations,
    session: AsyncSession,
) -> None:
    ana = await add_broker(session, "Ana Ribeiro", verified=True)
    url = f"/v1/staff/accounts/{ana.workspace_id}/view-as"
    await signed_in_as(api, integrations, session, StaffRole.COMMERCIAL)
    assert (await api.post(url, json={"reason": "suporte"})).status_code == 403

    staff = await signed_in_as(api, integrations, session, StaffRole.FINANCE)
    assert (await api.post(url, json={"reason": ""})).status_code == 422
    r = await api.post(url, json={"reason": "cliente pediu ajuda com o plano"})
    assert r.status_code == 200
    code = r.json()["url"].split("code=")[1].split("&")[0]
    [entry] = await _actions(session, "account.viewed_as")
    assert entry.actor_staff_id == staff.id and entry.reason == "cliente pediu ajuda com o plano"

    # The app host claims the code: a session without a refresh token.
    claimed = await app_client.post("/v1/auth/handoff/claim", json={"token": code})
    assert claimed.status_code == 204
    assert app_client.cookies.get("cv_at") and not app_client.cookies.get("cv_rt")
    me = (await app_client.get("/v1/me")).json()
    assert me["broker"]["display_name"] == "Ana Ribeiro"
    assert me["viewing_as"] == staff.name
    # Every write is refused.
    r = await app_client.patch("/v1/me/workspace", json={"plan": "essencial"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "read_only_session"
    r = await app_client.patch("/v1/me/broker-profile", json={"creci_number": "111.111"})
    assert r.status_code == 403
    assert (await app_client.post("/v1/auth/handoff")).status_code == 403
    # Leaving is allowed.
    assert (await app_client.post("/v1/auth/sign-out")).status_code == 204
    # The code works once.
    again = await app_client.post("/v1/auth/handoff/claim", json={"token": code})
    assert again.status_code == 400


async def test_scripts_cannot_view_as(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    ana = await add_broker(session, "Ana Ribeiro", verified=True)
    r = await api.post(
        f"/v1/staff/accounts/{ana.workspace_id}/view-as",
        json={"reason": "teste de script"},
        headers={"X-Admin-Token": "script-secret"},
    )
    assert r.status_code == 403
