"""Demo data for the backoffice, local and dev only. Every record is is_demo=true.

Brokers (one verified per region from the mockups, one pending CRECI) and captures of every kind
with names from the mockups. Demo records show the "Demonstrativo" badge and are never counted in
the overview. Refuses to run in production.

Run: python -m app.scripts.seed_backoffice_demo
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select

import app.models  # noqa: F401 - every table, for foreign keys across domains
from app.core.db import get_sessionmaker
from app.core.settings import get_settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import (
    BrokerProfile,
    CreciKind,
    CreciReviewStatus,
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

BROKERS: list[dict[str, Any]] = [
    {"name": "Ana Ribeiro", "creci": "000.000", "regions": ["Vila Mariana", "Saúde"], "ok": True},
    {
        "name": "Rafael Souza",
        "creci": "000.001",
        "regions": ["Vila Mariana", "Ipiranga"],
        "ok": True,
    },
    {"name": "Bianca Lopes", "creci": "000.004", "regions": ["Zona Sul"], "ok": True},
    {"name": "Carla Mendes", "creci": "000.002", "regions": ["Campinas"], "ok": False},
]

OWNER = {"transaction": "sale", "property_kind": "apartment"}
CAPTURES: list[tuple[InterestKind, str, str, dict[str, Any], InterestStatus, str | None]] = [
    (
        InterestKind.OWNER_LISTING,
        "Paulo Mendes",
        "+5511900000012",
        {
            **OWNER,
            "cep": "04010100",
            "bedrooms": 2,
            "area_m2": 68,
            "expected_price_cents": 70_000_000,
        },
        InterestStatus.CONFIRMED,
        "google",
    ),
    (
        InterestKind.OWNER_LISTING,
        "Regina Lima",
        "+5511900000088",
        {"transaction": "rent", "property_kind": "house", "cep": "04140000", "bedrooms": 3},
        InterestStatus.CONFIRMED,
        "instagram",
    ),
    (
        InterestKind.OWNER_LISTING,
        "Otávio Santos",
        "+5511900000040",
        {**OWNER, "cep": "05014000", "bedrooms": 3},
        InterestStatus.PENDING_OPT_IN,
        None,
    ),
    (
        InterestKind.AUCTION,
        "Marcos Alves",
        "+5511900000063",
        {
            "regions": "Zona Sul",
            "property_kinds": ["apartment"],
            "price_range": "300k_to_600k",
            "payment": "cash",
            "purpose": "invest",
            "has_participated": False,
        },
        InterestStatus.CONFIRMED,
        "google",
    ),
    (
        InterestKind.INVESTOR_INSTITUTIONAL,
        "Helena Prado",
        "+5511900000077",
        {"company": "Gestora Exemplo", "cities": ["São Paulo"]},
        InterestStatus.CONFIRMED,
        None,
    ),
    (
        InterestKind.AGENCY_DEMO,
        "Tiago Martins",
        "+5511900000055",
        {"company": "Imob. Vila Nova"},
        InterestStatus.CONFIRMED,
        "google",
    ),
]


async def seed() -> None:
    if get_settings().app_env == "production":
        raise SystemExit("Demo data never goes to production.")
    now = utcnow()
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(delete(InterestSignup).where(InterestSignup.is_demo.is_(True)))
        with cross_tenant(session):
            existing = {
                p.display_name
                for p in (
                    await session.scalars(select(BrokerProfile).where(BrokerProfile.is_demo))
                ).all()
            }
            for i, b in enumerate(BROKERS):
                if b["name"] in existing:
                    continue
                workspace = Workspace(name=b["name"], is_demo=True)
                user = User(email=f"demo.broker{i}@exemplo.com.br", name=b["name"], is_demo=True)
                session.add_all([workspace, user])
                await session.flush()
                session.add(Membership(workspace_id=workspace.id, user_id=user.id, role=Role.OWNER))
                session.add(
                    BrokerProfile(
                        workspace_id=workspace.id,
                        user_id=user.id,
                        display_name=b["name"],
                        slug=f"demo-corretor-{i}",
                        creci_name=b["name"],
                        creci_number=b["creci"],
                        creci_state="SP",
                        creci_kind=CreciKind.INDIVIDUAL,
                        creci_submitted_at=now - timedelta(hours=6 + i * 7),
                        creci_verified_at=now if b["ok"] else None,
                        creci_review_status=(
                            CreciReviewStatus.VERIFIED if b["ok"] else CreciReviewStatus.PENDING
                        ),
                        regions=b["regions"],
                        is_demo=True,
                    )
                )
            await session.flush()  # inside cross_tenant: brokers belong to their own workspaces
        for j, (kind, name, phone, criteria, status, source) in enumerate(CAPTURES):
            session.add(
                InterestSignup(
                    kind=kind,
                    name=name,
                    phone_e164=phone,
                    email=f"{name.split()[0].lower()}@exemplo.com.br",
                    criteria=criteria,
                    status=status,
                    utm_source=source,
                    utm_medium="organic" if source == "google" else ("paid" if source else None),
                    source_page="/anunciar-imovel" if kind == InterestKind.OWNER_LISTING else None,
                    created_at=now - timedelta(hours=j * 5),
                    is_demo=True,
                    consents=[
                        InterestSignupConsent(
                            purpose=ConsentPurpose.CONTACT_ABOUT_PROPERTIES,
                            granted=True,
                            granted_at=now,
                            source="demo seed",
                        )
                    ],
                )
            )
    print(f"Backoffice demo data: {len(BROKERS)} brokers, {len(CAPTURES)} captures (is_demo).")


if __name__ == "__main__":
    asyncio.run(seed())
