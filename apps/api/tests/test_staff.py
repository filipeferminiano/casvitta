"""Backoffice staff: allowlisted email-link sign-in, sessions, permissions, re-auth and audit."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.staff_deps import STAFF_ACCESS_COOKIE, require_permission
from app.core.db import get_session
from app.core.rate_limit import InMemoryRateLimiter
from app.core.security import encode_staff_token
from app.core.settings import Settings
from app.core.time import utcnow
from app.domains.accounts.models import AuditLog
from app.domains.staff.models import StaffRole, StaffSession, StaffUser
from app.domains.staff.permissions import ROLE_PERMISSIONS, SENSITIVE, Permission
from app.integrations.messaging.fake import FakeEmail
from app.integrations.registry import Integrations
from app.main import create_app

ADMIN_TOKEN = "script-secret"
LINK = re.compile(r"/entrar/confirmar#t=([\w-]+)")
CODE = re.compile(r"código é (\d{6})")

# The matrix exactly as drawn in docs/mockups/backoffice/08-team-audit (✓ = allowed),
# plus the two audit permissions decided on 21/11/2026.
ADM, OPS, COM, FIN = (
    StaffRole.ADMIN,
    StaffRole.OPERATIONS,
    StaffRole.COMMERCIAL,
    StaffRole.FINANCE,
)  # Leitura (read_only) has none of them
EXPECTED: dict[Permission, set[StaffRole]] = {
    Permission.VERIFY_CRECI: {ADM, OPS},
    Permission.HANDLE_CAPTURES: {ADM, OPS, COM},
    Permission.EXPORT_CONTACTS: {ADM, OPS, COM},
    Permission.MODERATE_LISTINGS: {ADM, OPS},
    Permission.REVEAL_CONTACTS: {ADM, OPS, COM, FIN},
    Permission.VIEW_AS_CUSTOMER: {ADM, OPS, FIN},
    Permission.MANAGE_BILLING: {ADM, FIN},
    Permission.MANAGE_STAFF: {ADM},
    Permission.VIEW_AUDIT: {ADM, OPS, COM, FIN},
    Permission.EXPORT_AUDIT: {ADM},
}

# One probe route per permission: exercises the real dependency, role by role.
probe = APIRouter(prefix="/v1/staff/probe")


async def _ok() -> dict[str, bool]:
    return {"ok": True}


for _permission in Permission:
    probe.add_api_route(
        f"/{_permission.value}",
        _ok,
        methods=["POST"],
        dependencies=[Depends(require_permission(_permission))],
    )


@pytest.fixture
def settings() -> Settings:
    return Settings(
        admin_token=ADMIN_TOKEN,
        admin_token_enabled=True,
        cookie_path_prefix="",
        auth_rate_limit_per_minute=100,
    )


def _make_client(make_session, integrations: Integrations, settings: Settings):  # type: ignore[no-untyped-def]
    app = create_app(
        settings=settings, integrations=integrations, rate_limiter=InMemoryRateLimiter()
    )
    app.include_router(probe)

    async def _session() -> AsyncIterator[AsyncSession]:
        async with make_session() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    )


@pytest.fixture
async def api(
    make_session, integrations: Integrations, settings: Settings
) -> AsyncIterator[AsyncClient]:  # type: ignore[no-untyped-def]
    async with _make_client(make_session, integrations, settings) as client:
        yield client


def _outbox(integrations: Integrations) -> FakeEmail:
    assert isinstance(integrations.email, FakeEmail)
    return integrations.email


async def _staff(
    session: AsyncSession, email: str, role: StaffRole, *, active: bool = True
) -> StaffUser:
    staff = StaffUser(
        email=email, name=email.split("@", maxsplit=1)[0].title(), role=role, active=active
    )
    session.add(staff)
    await session.commit()
    return staff


async def _sign_in(api: AsyncClient, integrations: Integrations, email: str) -> None:
    sent = len(_outbox(integrations).outbox)
    r = await api.post("/v1/staff/auth/email-link", json={"email": email})
    assert r.status_code == 202
    assert len(_outbox(integrations).outbox) == sent + 1, "allowlisted staff get a link"
    match = LINK.search(_outbox(integrations).outbox[-1].text)
    assert match
    r = await api.post("/v1/staff/auth/confirm", json={"token": match.group(1)})
    assert r.status_code == 204, r.text


async def _age_proof(
    session: AsyncSession, api: AsyncClient, settings: Settings, staff: StaffUser
) -> None:
    """Pretends the last proof of identity is old: sensitive actions then need a new code."""
    old = utcnow() - timedelta(minutes=settings.staff_reauth_minutes + 1)
    current = await session.scalar(
        select(StaffSession)
        .where(StaffSession.staff_user_id == staff.id, StaffSession.revoked_at.is_(None))
        .order_by(StaffSession.created_at.desc())
    )
    assert current
    jar = next(c for c in api.cookies.jar if c.name == STAFF_ACCESS_COOKIE)
    api.cookies.set(
        STAFF_ACCESS_COOKIE,
        encode_staff_token(settings, staff.id, current.family_id, old),
        domain=jar.domain,
        path=jar.path,
    )


# ------------------------------------------------------------------ sign-in


async def test_only_allowlisted_active_staff_get_a_link(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _staff(session, "inativa@casvitta.com.br", StaffRole.ADMIN, active=False)
    for email in ("cliente@exemplo.com.br", "inativa@casvitta.com.br"):
        r = await api.post("/v1/staff/auth/email-link", json={"email": email})
        assert r.status_code == 202 and r.json() == {"status": "sent"}  # same answer for all
    assert _outbox(integrations).outbox == []

    await _staff(session, "filipe@casvitta.com.br", StaffRole.ADMIN)
    await _sign_in(api, integrations, "Filipe@Casvitta.com.br ")
    me = (await api.get("/v1/staff/me")).json()
    assert me["role"] == "admin" and set(me["permissions"]) == {p.value for p in Permission}
    assert me["environment"] == "development" and "creci" in me["modules"]
    assert me["reauth_valid_until"] is not None
    actions = (await session.scalars(select(AuditLog.action))).all()
    assert "staff.signed_in" in actions


async def test_link_works_once_and_customer_sessions_never_pass(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _staff(session, "ops@casvitta.com.br", StaffRole.OPERATIONS)
    await api.post("/v1/staff/auth/email-link", json={"email": "ops@casvitta.com.br"})
    match = LINK.search(_outbox(integrations).outbox[-1].text)
    assert match
    assert (
        await api.post("/v1/staff/auth/confirm", json={"token": match.group(1)})
    ).status_code == 204
    assert (
        await api.post("/v1/staff/auth/confirm", json={"token": match.group(1)})
    ).status_code == 400

    # A staff token is not a customer token, and the reverse.
    staff_cookie = api.cookies.get(STAFF_ACCESS_COOKIE)
    assert staff_cookie
    api.cookies.clear()
    api.cookies.set("cv_at", staff_cookie)
    assert (await api.get("/v1/me")).status_code == 401
    api.cookies.clear()
    api.cookies.set("cv_st_at", "not-a-token")
    assert (await api.get("/v1/staff/me")).status_code == 401


async def test_refresh_rotates_and_reuse_ends_the_session(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _staff(session, "ops@casvitta.com.br", StaffRole.OPERATIONS)
    await _sign_in(api, integrations, "ops@casvitta.com.br")
    first = api.cookies.get("cv_st_rt")
    assert (await api.post("/v1/staff/auth/refresh")).status_code == 204
    assert api.cookies.get("cv_st_rt") != first
    # The old refresh token comes back: every session of this login ends.
    api.cookies.set("cv_st_rt", first or "")
    r = await api.post("/v1/staff/auth/refresh")
    assert r.status_code == 401
    assert (await api.get("/v1/staff/me")).status_code == 401


async def test_idle_session_expires(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _staff(session, "ops@casvitta.com.br", StaffRole.OPERATIONS)
    await _sign_in(api, integrations, "ops@casvitta.com.br")
    await session.execute(update(StaffSession).values(expires_at=utcnow() - timedelta(seconds=1)))
    await session.commit()
    assert (await api.post("/v1/staff/auth/refresh")).status_code == 401


async def test_deactivating_someone_ends_their_session(
    make_session,
    integrations: Integrations,
    settings: Settings,
    session: AsyncSession,  # type: ignore[no-untyped-def]
) -> None:
    await _staff(session, "admin@casvitta.com.br", StaffRole.ADMIN)
    caio = await _staff(session, "caio@casvitta.com.br", StaffRole.COMMERCIAL)
    async with (
        _make_client(make_session, integrations, settings) as admin,
        _make_client(make_session, integrations, settings) as other,
    ):
        await _sign_in(admin, integrations, "admin@casvitta.com.br")
        await _sign_in(other, integrations, "caio@casvitta.com.br")
        assert (await other.get("/v1/staff/me")).status_code == 200
        r = await admin.patch(f"/v1/staff/team/{caio.id}", json={"active": False})
        assert r.status_code == 200 and r.json()["active"] is False
        assert (await other.get("/v1/staff/me")).status_code == 401
        assert (await other.post("/v1/staff/auth/refresh")).status_code == 401


# ------------------------------------------------------------------ permissions


def test_matrix_matches_the_mockup() -> None:
    for permission, roles in EXPECTED.items():
        granted = {role for role, perms in ROLE_PERMISSIONS.items() if permission in perms}
        assert granted == roles, permission
    assert set(EXPECTED) == set(Permission)


@pytest.mark.parametrize("role", list(StaffRole))
async def test_each_role_against_each_permission(
    api: AsyncClient, integrations: Integrations, session: AsyncSession, role: StaffRole
) -> None:
    email = f"{role.value}@casvitta.com.br"
    await _staff(session, email, role)
    await _sign_in(api, integrations, email)  # fresh proof: sensitive ones pass too
    for permission in Permission:
        r = await api.post(f"/v1/staff/probe/{permission.value}")
        expected = 200 if role in EXPECTED[permission] else 403
        assert r.status_code == expected, (role, permission, r.text)
    # Every role, Leitura included, reads the backoffice.
    assert (await api.get("/v1/staff/team")).status_code == 200


async def test_sensitive_actions_need_a_recent_code(
    api: AsyncClient, integrations: Integrations, session: AsyncSession, settings: Settings
) -> None:
    staff = await _staff(session, "ops@casvitta.com.br", StaffRole.OPERATIONS)
    await _sign_in(api, integrations, "ops@casvitta.com.br")
    await _age_proof(session, api, settings, staff)

    for permission in SENSITIVE & ROLE_PERMISSIONS[StaffRole.OPERATIONS]:
        r = await api.post(f"/v1/staff/probe/{permission.value}")
        assert r.status_code == 403 and r.json()["error"]["code"] == "reauth_required"
    # Non-sensitive ones still work.
    assert (await api.post("/v1/staff/probe/creci.verify")).status_code == 200

    assert (await api.post("/v1/staff/auth/reauth/request")).status_code == 202
    match = CODE.search(_outbox(integrations).outbox[-1].text)
    assert match
    code = match.group(1)
    wrong = "000000" if code != "000000" else "111111"
    r = await api.post("/v1/staff/auth/reauth/confirm", json={"code": wrong})
    assert r.status_code == 400 and r.json()["error"]["code"] == "reauth_code_invalid"
    r = await api.post("/v1/staff/auth/reauth/confirm", json={"code": code})
    assert r.status_code == 200 and r.json()["reauth_valid_until"] is not None
    assert (await api.post("/v1/staff/probe/contacts.reveal")).status_code == 200
    # The code works once.
    r = await api.post("/v1/staff/auth/reauth/confirm", json={"code": code})
    assert r.status_code == 400


async def test_reauth_code_locks_after_too_many_attempts(
    api: AsyncClient, integrations: Integrations, session: AsyncSession, settings: Settings
) -> None:
    await _staff(session, "ops@casvitta.com.br", StaffRole.OPERATIONS)
    await _sign_in(api, integrations, "ops@casvitta.com.br")
    await api.post("/v1/staff/auth/reauth/request")
    match = CODE.search(_outbox(integrations).outbox[-1].text)
    assert match
    wrong = "000000" if match.group(1) != "000000" else "111111"
    for _ in range(settings.staff_reauth_max_attempts):
        await api.post("/v1/staff/auth/reauth/confirm", json={"code": wrong})
    r = await api.post("/v1/staff/auth/reauth/confirm", json={"code": match.group(1)})
    assert r.status_code == 400


# ------------------------------------------------------------------ admin token


async def test_admin_token_only_when_enabled(
    make_session,
    integrations: Integrations,
    session: AsyncSession,  # type: ignore[no-untyped-def]
) -> None:
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    disabled = Settings(admin_token=ADMIN_TOKEN, admin_token_enabled=False, cookie_path_prefix="")
    async with _make_client(make_session, integrations, disabled) as api:
        assert (await api.get("/v1/admin/brokers", headers=headers)).status_code == 401

    enabled = Settings(admin_token=ADMIN_TOKEN, admin_token_enabled=True, cookie_path_prefix="")
    async with _make_client(make_session, integrations, enabled) as api:
        assert (await api.get("/v1/admin/brokers", headers=headers)).status_code == 200
        wrong = {"X-Admin-Token": "nope"}
        assert (await api.get("/v1/admin/brokers", headers=wrong)).status_code == 401
    actors = (await session.scalars(select(AuditLog.actor))).all()
    assert actors == ["system:admin-token"]


async def test_bootstrap_creates_the_first_admin_once(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    body = {"email": "filipe@casvitta.com.br", "name": "Filipe"}
    assert (await api.post("/v1/staff/bootstrap", json=body)).status_code == 401
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    r = await api.post("/v1/staff/bootstrap", json=body, headers=headers)
    assert r.status_code == 201 and r.json()["role"] == "admin"
    again = await api.post(
        "/v1/staff/bootstrap", json={**body, "email": "outra@casvitta.com.br"}, headers=headers
    )
    assert again.status_code == 409
    await _sign_in(api, integrations, "filipe@casvitta.com.br")
    # A staff session cannot call the script-only bootstrap.
    assert (await api.post("/v1/staff/bootstrap", json=body)).status_code == 403


# ------------------------------------------------------------------ team


async def test_admin_invites_and_changes_roles_with_audit(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    admin = await _staff(session, "filipe@casvitta.com.br", StaffRole.ADMIN)
    await _sign_in(api, integrations, "filipe@casvitta.com.br")
    r = await api.post(
        "/v1/staff/team",
        json={"email": "Marina@Casvitta.com.br", "name": "Marina", "role": "operations"},
    )
    assert r.status_code == 201
    marina = r.json()
    assert marina["email"] == "marina@…"  # masked in lists
    dup = await api.post(
        "/v1/staff/team",
        json={"email": "marina@casvitta.com.br", "name": "Marina", "role": "finance"},
    )
    assert dup.status_code == 409
    r = await api.patch(f"/v1/staff/team/{marina['id']}", json={"role": "commercial"})
    assert r.json()["role"] == "commercial"
    # The last active Admin cannot step down.
    r = await api.patch(f"/v1/staff/team/{admin.id}", json={"role": "read_only"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "last_admin"

    rows = (await session.scalars(select(AuditLog).where(AuditLog.action.like("staff.%")))).all()
    by_action = {row.action: row for row in rows}
    assert by_action["staff.invited"].actor_staff_id == admin.id
    assert by_action["staff.updated"].details["changes"] == {
        "role": "commercial",
        "previous_role": "operations",
    }


# ------------------------------------------------------------------ audit log


async def test_audit_filters_and_audited_export(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    admin = await _staff(session, "filipe@casvitta.com.br", StaffRole.ADMIN)
    await _staff(session, "ops@casvitta.com.br", StaffRole.OPERATIONS)
    await _sign_in(api, integrations, "ops@casvitta.com.br")
    page = (await api.get("/v1/staff/audit")).json()
    assert [i["action"] for i in page["items"]] == ["staff.signed_in"]
    assert page["items"][0]["actor_name"] == "Ops"
    # Operações views the log but cannot export it.
    assert (await api.get("/v1/staff/audit/export")).status_code == 403

    api.cookies.clear()
    await _sign_in(api, integrations, "filipe@casvitta.com.br")
    mine = (await api.get("/v1/staff/audit", params={"staff_id": str(admin.id)})).json()
    assert [i["actor_staff_id"] for i in mine["items"]] == [str(admin.id)]
    signed = (await api.get("/v1/staff/audit", params={"action": "staff.signed_in"})).json()
    assert len(signed["items"]) == 2
    future = (utcnow() + timedelta(days=1)).isoformat()
    assert (await api.get("/v1/staff/audit", params={"since": future})).json()["items"] == []

    r = await api.get("/v1/staff/audit/export", params={"action": "staff.signed_in"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0] == "data,hora,quem,acao,entidade,id,motivo,detalhe" and len(lines) == 3
    exported = await session.scalar(select(AuditLog).where(AuditLog.action == "audit.exported"))
    assert exported is not None and exported.actor_staff_id == admin.id
    assert exported.details["count"] == 2


async def test_audit_paginates(
    api: AsyncClient, integrations: Integrations, session: AsyncSession
) -> None:
    await _staff(session, "filipe@casvitta.com.br", StaffRole.ADMIN)
    for i in range(5):
        session.add(
            AuditLog(
                actor="system",
                action="test.event",
                entity="x",
                details={"i": i},
                occurred_at=utcnow() - timedelta(hours=i + 1),
            )
        )
    await session.commit()
    await _sign_in(api, integrations, "filipe@casvitta.com.br")
    first = (await api.get("/v1/staff/audit", params={"action": "test.event", "limit": 3})).json()
    assert [i["details"]["i"] for i in first["items"]] == [0, 1, 2]
    assert first["items"][0]["actor_name"] == "Sistema"
    second = (
        await api.get(
            "/v1/staff/audit",
            params={"action": "test.event", "limit": 3, "before": first["next_before"]},
        )
    ).json()
    assert [i["details"]["i"] for i in second["items"]] == [3, 4]
    assert second["next_before"] is None
