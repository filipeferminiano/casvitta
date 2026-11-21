"""Shared helpers for backoffice tests: staff accounts, sign-in, brokers and captures."""

from __future__ import annotations

import itertools
import re
import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.rate_limit import InMemoryRateLimiter
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import (
    BrokerProfile,
    CreciKind,
    Membership,
    Role,
    User,
    Workspace,
)
from app.domains.interest.models import (
    ConsentPurpose,
    InterestKind,
    InterestSignup,
    InterestSignupConsent,
    InterestStatus,
)
from app.domains.staff.models import StaffRole, StaffUser
from app.integrations.messaging.fake import FakeEmail
from app.integrations.registry import Integrations
from app.main import create_app

LINK = re.compile(r"/entrar/confirmar#t=([\w-]+)")
_seq = itertools.count(1)


def staff_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = {
        "admin_token": "script-secret",
        "admin_token_enabled": True,
        "cookie_path_prefix": "",
        "auth_rate_limit_per_minute": 500,
    }
    base.update(overrides)
    return Settings(**base)


def make_client(make_session, integrations: Integrations, settings: Settings) -> AsyncClient:  # type: ignore[no-untyped-def]
    app = create_app(
        settings=settings, integrations=integrations, rate_limiter=InMemoryRateLimiter()
    )

    async def _session() -> AsyncIterator[AsyncSession]:
        async with make_session() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    )


def outbox(integrations: Integrations) -> FakeEmail:
    assert isinstance(integrations.email, FakeEmail)
    return integrations.email


async def add_staff(
    session: AsyncSession, email: str, role: StaffRole, *, active: bool = True
) -> StaffUser:
    staff = StaffUser(
        email=email, name=email.split("@", maxsplit=1)[0].title(), role=role, active=active
    )
    session.add(staff)
    await session.commit()
    return staff


async def sign_in(api: AsyncClient, integrations: Integrations, email: str) -> None:
    r = await api.post("/v1/staff/auth/email-link", json={"email": email})
    assert r.status_code == 202
    match = LINK.search(outbox(integrations).outbox[-1].text)
    assert match, "allowlisted staff get a link"
    r = await api.post("/v1/staff/auth/confirm", json={"token": match.group(1)})
    assert r.status_code == 204, r.text


async def signed_in_as(
    api: AsyncClient, integrations: Integrations, session: AsyncSession, role: StaffRole
) -> StaffUser:
    staff = await add_staff(session, f"{role.value}{next(_seq)}@casvitta.com.br", role)
    api.cookies.clear()
    await sign_in(api, integrations, staff.email)
    return staff


async def add_broker(
    session: AsyncSession,
    name: str,
    *,
    creci: str | None = "123.456",
    state: str = "SP",
    verified: bool = False,
    submitted_at: datetime | None = None,
    regions: list[str] | None = None,
    is_demo: bool = False,
) -> BrokerProfile:
    n = next(_seq)
    with cross_tenant(session):
        workspace = Workspace(name=name, is_demo=is_demo)
        user = User(email=f"broker{n}@exemplo.com.br", name=name, is_demo=is_demo)
        session.add_all([workspace, user])
        await session.flush()
        session.add(Membership(workspace_id=workspace.id, user_id=user.id, role=Role.OWNER))
        profile = BrokerProfile(
            workspace_id=workspace.id,
            user_id=user.id,
            display_name=name,
            slug=f"corretor-{n}",
            creci_name=name if creci else None,
            creci_number=creci,
            creci_state=state if creci else None,
            creci_kind=CreciKind.INDIVIDUAL if creci else None,
            creci_submitted_at=(submitted_at or utcnow()) if creci else None,
            creci_verified_at=utcnow() if verified else None,
            regions=regions or [],
            is_demo=is_demo,
        )
        session.add(profile)
        await session.flush()
    await session.commit()
    return profile


async def add_capture(
    session: AsyncSession,
    kind: InterestKind,
    name: str = "Paulo Mendes",
    *,
    phone: str = "+5511927408912",
    email: str | None = "paulo@exemplo.com.br",
    status: InterestStatus = InterestStatus.CONFIRMED,
    criteria: dict[str, Any] | None = None,
    created_at: datetime | None = None,
    consent: bool = True,
) -> InterestSignup:
    signup = InterestSignup(
        id=uuid.uuid4(),
        kind=kind,
        name=name,
        phone_e164=phone,
        email=email,
        criteria=criteria or {},
        status=status,
        source_page="/anunciar-imovel",
    )
    if created_at is not None:
        signup.created_at = created_at
    signup.consents = [
        InterestSignupConsent(
            purpose=ConsentPurpose.CONTACT_ABOUT_PROPERTIES,
            granted=consent,
            granted_at=utcnow(),
            source="test",
        )
    ]
    session.add(signup)
    await session.commit()
    return signup
