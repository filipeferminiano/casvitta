"""CRM-0: one catalog, entitlements per plan, limit states, and staff-assigned plan changes."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core import catalog
from app.core.catalog import Feature, Meter, limit, limit_state
from app.core.security import encode_access_token
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.domains.accounts.models import AuditLog, Plan, Workspace
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, add_staff, make_client, sign_in, staff_settings

U = None  # unlimited

# Every row of PROMPT_CRM_BUILD §1 / mockup 00-prices-hypotheses.
LIMITS: dict[Plan, dict[Meter, int | None]] = {
    Plan.FREE: {
        Meter.USERS: 1, Meter.ACTIVE_PROPERTIES: 5, Meter.CRM_CONTACTS: 100,
        Meter.AUTOMATION_CONTACTS_MONTH: 0, Meter.JOURNEYS: 0, Meter.AGENTS: 0,
        Meter.AI_CONVERSATIONS_MONTH: 0, Meter.INCLUDED_HIGHLIGHTS_MONTH: 0,
    },
    Plan.ESSENTIAL: {
        Meter.USERS: 1, Meter.ACTIVE_PROPERTIES: 30, Meter.CRM_CONTACTS: 2_000,
        Meter.AUTOMATION_CONTACTS_MONTH: 0, Meter.JOURNEYS: 0, Meter.AGENTS: 0,
        Meter.AI_CONVERSATIONS_MONTH: 0, Meter.INCLUDED_HIGHLIGHTS_MONTH: 0,
    },
    Plan.AUTOMATION: {
        Meter.USERS: 1, Meter.ACTIVE_PROPERTIES: 100, Meter.CRM_CONTACTS: U,
        Meter.AUTOMATION_CONTACTS_MONTH: 1_000, Meter.JOURNEYS: 3, Meter.AGENTS: 1,
        Meter.AI_CONVERSATIONS_MONTH: 200, Meter.INCLUDED_HIGHLIGHTS_MONTH: 0,
    },
    Plan.PRO: {
        Meter.USERS: 2, Meter.ACTIVE_PROPERTIES: 300, Meter.CRM_CONTACTS: U,
        Meter.AUTOMATION_CONTACTS_MONTH: 5_000, Meter.JOURNEYS: U, Meter.AGENTS: U,
        Meter.AI_CONVERSATIONS_MONTH: 1_000, Meter.INCLUDED_HIGHLIGHTS_MONTH: 1,
    },
    Plan.AGENCY: {
        Meter.USERS: 5, Meter.ACTIVE_PROPERTIES: 1_000, Meter.CRM_CONTACTS: U,
        Meter.AUTOMATION_CONTACTS_MONTH: 15_000, Meter.JOURNEYS: U, Meter.AGENTS: U,
        Meter.AI_CONVERSATIONS_MONTH: 3_000, Meter.INCLUDED_HIGHLIGHTS_MONTH: 3,
    },
}  # fmt: skip

PRICES = {Plan.FREE: (0, None), Plan.ESSENTIAL: (4_900, 4_100), Plan.AUTOMATION: (14_900, 12_400),
          Plan.PRO: (29_900, 24_900), Plan.AGENCY: (49_900, 41_600)}  # fmt: skip

F = Feature
FROM_ESSENTIAL = {F.UNBRANDED_PAGE, F.PIPELINE_AND_CALENDAR, F.TRACKED_FORMS, F.INSTAGRAM_INBOX}
FROM_AUTOMATION = {
    F.CUSTOM_DOMAIN, F.GOOGLE_CALENDAR, F.SEGMENTS, F.WHATSAPP_CONNECTED, F.COMMENT_TO_DM,
    F.AGENT_BOOKS_VISITS, F.SAVED_SEARCH_ALERTS,
}  # fmt: skip
AGENCY_ONLY = {F.PAGE_PER_BROKER, F.DISTRIBUTION_AND_PERMISSIONS}
EVERY_PLAN = {F.BROKER_PAGE, F.CONTACT_HISTORY, F.WHATSAPP_BUTTON, F.HIGHLIGHTS_ONE_OFF}
ORDER = [Plan.FREE, Plan.ESSENTIAL, Plan.AUTOMATION, Plan.PRO, Plan.AGENCY]


@pytest.mark.parametrize("plan", ORDER)
def test_limits_and_prices_match_the_catalog_table(plan: Plan) -> None:
    for meter, expected in LIMITS[plan].items():
        assert limit(plan, meter) == expected, (plan, meter)
    spec = catalog.spec(plan)
    assert (spec.monthly_cents, spec.annual_monthly_cents) == PRICES[plan]
    assert spec.price_from is (plan == Plan.AGENCY)
    assert spec.extra_user_cents == (5_900 if plan == Plan.AGENCY else None)


@pytest.mark.parametrize("plan", ORDER)
def test_features_per_plan(plan: Plan) -> None:
    rank = ORDER.index(plan)
    expected = set(EVERY_PLAN)
    if rank >= 1:
        expected |= FROM_ESSENTIAL
    if rank >= 2:
        expected |= FROM_AUTOMATION
    if plan == Plan.AGENCY:
        expected |= AGENCY_ONLY
    assert catalog.spec(plan).features == expected


def test_add_ons_destaques_and_owner_packages() -> None:
    add_ons = {a.key: (a.price_cents, a.meter, a.amount) for a in catalog.ADD_ONS}
    assert add_ons == {
        "ai_conversations_500": (4_900, Meter.AI_CONVERSATIONS_MONTH, 500),
        "automation_contacts_1000": (3_900, Meter.AUTOMATION_CONTACTS_MONTH, 1_000),
        "agency_extra_user": (5_900, Meter.USERS, 1),
    }
    assert catalog.HIGHLIGHT_PACKAGES == {7: 3_900, 30: 11_900}
    assert catalog.OWNER_PACKAGES == {30: 5_900, 90: 14_900}


def test_limit_states_warn_at_80_and_stop_at_100() -> None:
    m = Meter.AI_CONVERSATIONS_MONTH
    assert limit_state(Plan.AUTOMATION, m, 159) == "ok"
    assert limit_state(Plan.AUTOMATION, m, 160) == "warning"  # 80 % of 200
    assert limit_state(Plan.AUTOMATION, m, 200) == "reached"
    assert limit_state(Plan.AUTOMATION, m, 200, extra=500) == "ok"  # add-on bought
    assert limit_state(Plan.ESSENTIAL, m, 0) == "not_included"
    assert limit_state(Plan.PRO, Meter.CRM_CONTACTS, 10**6) == "ok"  # unlimited
    assert catalog.allows_more(Plan.FREE, Meter.ACTIVE_PROPERTIES, 4)
    assert not catalog.allows_more(Plan.FREE, Meter.ACTIVE_PROPERTIES, 5)


def test_legacy_plans_keep_working_but_are_never_sold() -> None:
    for legacy in (Plan.CORRETOR, Plan.ESSENCIAL, Plan.PROFISSIONAL):
        assert not catalog.spec(legacy).sellable
        assert legacy not in catalog.SELLABLE
    assert catalog.spec(Plan.CORRETOR).limits == catalog.spec(Plan.ESSENTIAL).limits


def _broker_headers(settings: Settings, user_id: Any, workspace_id: Any) -> dict[str, str]:
    return {"cookie": f"cv_at={encode_access_token(settings, user_id, workspace_id)}"}


async def test_public_catalog_hides_annual_unless_enabled(
    make_session,
    integrations: Integrations,  # type: ignore[no-untyped-def]
) -> None:
    async with make_client(make_session, integrations, Settings()) as api:
        body = (await api.get("/v1/public/catalog")).json()
    assert body["show_annual_prices"] is False
    assert [p["key"] for p in body["plans"]] == [p.value for p in ORDER]
    assert body["highlight_packages"] == [
        {"days": 7, "price_cents": 3_900},
        {"days": 30, "price_cents": 11_900},
    ]


async def test_upgrade_request_is_assigned_by_staff_and_audited(
    make_session,
    integrations: Integrations,  # type: ignore[no-untyped-def]
) -> None:
    settings = staff_settings()
    async with make_session() as setup:
        broker = await add_broker(setup, "Ana Ribeiro", verified=True)
        await add_staff(setup, "fin@casvitta.com.br", StaffRole.FINANCE)
        await add_staff(setup, "leitura@casvitta.com.br", StaffRole.READ_ONLY)
    headers = _broker_headers(settings, broker.user_id, broker.workspace_id)

    api: AsyncClient
    async with make_client(make_session, integrations, settings) as api:
        usage = (await api.get("/v1/me/plan", headers=headers)).json()
        assert usage["plan"] == "free" and usage["billing_enabled"] is False
        props = next(m for m in usage["meters"] if m["meter"] == "active_properties")
        assert props == {"meter": "active_properties", "used": 0, "limit": 5, "state": "ok"}

        r = await api.post(
            "/v1/me/plan/requests",
            json={"requested_plan": "automation", "source": "limit_reached"},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        request_id = r.json()["id"]
        bad = await api.post(
            "/v1/me/plan/requests", json={"requested_plan": "corretor"}, headers=headers
        )
        assert bad.status_code == 422

    async with make_client(make_session, integrations, settings) as staff_api:
        await sign_in(staff_api, integrations, "leitura@casvitta.com.br")
        assert (await staff_api.get("/v1/staff/plan-requests")).status_code == 403

    async with make_client(make_session, integrations, settings) as staff_api:
        await sign_in(staff_api, integrations, "fin@casvitta.com.br")
        queue = (await staff_api.get("/v1/staff/plan-requests")).json()
        assert [q["id"] for q in queue] == [request_id]
        assert queue[0]["workspace_name"] == "Ana Ribeiro"
        r = await staff_api.post(f"/v1/staff/plan-requests/{request_id}/approve")
        assert r.status_code == 204
        assert (await staff_api.get("/v1/staff/plan-requests")).json() == []

    async with make_session() as check:
        with cross_tenant(check):
            workspace = await check.get(Workspace, broker.workspace_id)
            entry = await check.scalar(
                select(AuditLog).where(AuditLog.action == "plan_request.approved")
            )
        assert workspace is not None and workspace.plan == Plan.AUTOMATION
        assert entry is not None and entry.details["plan"] == "automation"


def test_web_snapshot_is_up_to_date() -> None:
    """packages/config/catalog.json must match the catalog: run `make catalog:gen`."""
    import json  # noqa: PLC0415
    from pathlib import Path  # noqa: PLC0415

    snapshot = Path(__file__).resolve().parents[3] / "packages/config/catalog.json"
    expected = catalog.catalog_out(show_annual_prices=False).model_dump(mode="json")
    assert json.loads(snapshot.read_text("utf-8")) == expected
