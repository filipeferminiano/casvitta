"""The one price and plan catalog (PROMPT_CRM_BUILD §1, mockup landing-pages/00-prices-hypotheses).

Consumed by API gates (entitlements), the backoffice (plans, revenue lines), the public catalog
endpoint, and the web through the generated snapshot packages/config/catalog.json (`make
catalog:gen`): landing pages, the prices page, signup and llms.txt. Prices are hypotheses
(nov/2026); never shown as a promotion, discount or trial. Money in integer cents.

Definitions (also in the FAQ):
- Active property: published or draft. Sold, rented and paused don't count.
- AI conversation: a conversation where the assistant replied; counted once per 24 hours.
- Contact in automation: received at least one automated message in the month.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel

from app.domains.accounts.models import Plan

CATALOG_VERSION = "2026-11-21"
# "No anual, você paga 10 meses e usa 12."
ANNUAL_MONTHS_PAID = 10

UNLIMITED: None = None  # a None limit means "ilimitado"


class Feature(StrEnum):
    BROKER_PAGE = "broker_page"  # page with CRECI on {slug}.casvitta.com.br
    UNBRANDED_PAGE = "unbranded_page"  # page without the Casvitta brand
    CUSTOM_DOMAIN = "custom_domain"
    PAGE_PER_BROKER = "page_per_broker"
    CONTACT_HISTORY = "contact_history"  # history and next steps
    PIPELINE_AND_CALENDAR = "pipeline_and_calendar"
    GOOGLE_CALENDAR = "google_calendar"
    TRACKED_FORMS = "tracked_forms"  # forms and links with source
    PAGE_COLLECTIONS = "page_collections"  # Seleções and "Vi no Instagram" on the page
    SEGMENTS = "segments"
    DISTRIBUTION_AND_PERMISSIONS = "distribution_and_permissions"
    WHATSAPP_BUTTON = "whatsapp_button"  # WhatsApp button with the property code
    INSTAGRAM_INBOX = "instagram_inbox"
    WHATSAPP_CONNECTED = "whatsapp_connected"
    COMMENT_TO_DM = "comment_to_dm"
    AGENT_BOOKS_VISITS = "agent_books_visits"
    SAVED_SEARCH_ALERTS = "saved_search_alerts"  # open decision: from Automação (needs WhatsApp)
    HIGHLIGHTS_ONE_OFF = "highlights_one_off"


class Meter(StrEnum):
    USERS = "users"
    ACTIVE_PROPERTIES = "active_properties"
    CRM_CONTACTS = "crm_contacts"
    AUTOMATION_CONTACTS_MONTH = "automation_contacts_month"
    JOURNEYS = "journeys"
    AGENTS = "agents"
    AI_CONVERSATIONS_MONTH = "ai_conversations_month"
    INCLUDED_HIGHLIGHTS_MONTH = "included_highlights_month"


ReportLevel = Literal["basic", "full", "by_source", "by_broker"]


@dataclass(frozen=True, slots=True)
class PlanSpec:
    key: Plan
    monthly_cents: int
    # Imobiliária is "a partir de": the monthly price is the starting price.
    price_from: bool
    # Limits: an int, 0 = not included, None = unlimited.
    limits: dict[Meter, int | None]
    features: frozenset[Feature]
    reports: ReportLevel
    extra_user_cents: int | None = None
    sellable: bool = True  # legacy plans stay valid on existing workspaces only

    @property
    def annual_monthly_cents(self) -> int | None:
        """Per-month price when paid yearly (10 months for 12), rounded to whole reais."""
        if self.monthly_cents == 0:
            return None
        return round(self.monthly_cents * ANNUAL_MONTHS_PAID / 12 / 100) * 100


@dataclass(frozen=True, slots=True)
class AddOn:
    key: str
    price_cents: int
    meter: Meter
    amount: int
    plans: frozenset[Plan] = field(default_factory=frozenset)


_BASE = frozenset({Feature.BROKER_PAGE, Feature.CONTACT_HISTORY, Feature.WHATSAPP_BUTTON})
_ESSENTIAL = _BASE | {
    Feature.UNBRANDED_PAGE,
    Feature.PIPELINE_AND_CALENDAR,
    Feature.TRACKED_FORMS,
    Feature.PAGE_COLLECTIONS,
    Feature.INSTAGRAM_INBOX,
}
_AUTOMATION = _ESSENTIAL | {
    Feature.CUSTOM_DOMAIN,
    Feature.GOOGLE_CALENDAR,
    Feature.SEGMENTS,
    Feature.WHATSAPP_CONNECTED,
    Feature.COMMENT_TO_DM,
    Feature.AGENT_BOOKS_VISITS,
    Feature.SAVED_SEARCH_ALERTS,
}
_AGENCY = _AUTOMATION | {Feature.PAGE_PER_BROKER, Feature.DISTRIBUTION_AND_PERMISSIONS}
# Destaques avulsos are sold in every plan.
_ALL = Feature.HIGHLIGHTS_ONE_OFF


def _limits(
    *,
    users: int,
    properties: int,
    contacts: int | None,
    automation: int,
    journeys: int | None,
    agents: int | None,
    ai: int,
    highlights: int,
) -> dict[Meter, int | None]:
    return {
        Meter.USERS: users,
        Meter.ACTIVE_PROPERTIES: properties,
        Meter.CRM_CONTACTS: contacts,
        Meter.AUTOMATION_CONTACTS_MONTH: automation,
        Meter.JOURNEYS: journeys,
        Meter.AGENTS: agents,
        Meter.AI_CONVERSATIONS_MONTH: ai,
        Meter.INCLUDED_HIGHLIGHTS_MONTH: highlights,
    }


PLANS: dict[Plan, PlanSpec] = {
    Plan.FREE: PlanSpec(
        Plan.FREE,
        0,
        False,
        _limits(
            users=1,
            properties=5,
            contacts=100,
            automation=0,
            journeys=0,
            agents=0,
            ai=0,
            highlights=0,
        ),
        _BASE | {_ALL},
        "basic",
    ),
    Plan.ESSENTIAL: PlanSpec(
        Plan.ESSENTIAL,
        4_900,
        False,
        _limits(
            users=1,
            properties=30,
            contacts=2_000,
            automation=0,
            journeys=0,
            agents=0,
            ai=0,
            highlights=0,
        ),
        _ESSENTIAL | {_ALL},
        "basic",
    ),
    Plan.AUTOMATION: PlanSpec(
        Plan.AUTOMATION,
        14_900,
        False,
        _limits(
            users=1,
            properties=100,
            contacts=UNLIMITED,
            automation=1_000,
            journeys=3,
            agents=1,
            ai=200,
            highlights=0,
        ),
        _AUTOMATION | {_ALL},
        "full",
    ),
    Plan.PRO: PlanSpec(
        Plan.PRO,
        29_900,
        False,
        _limits(
            users=2,
            properties=300,
            contacts=UNLIMITED,
            automation=5_000,
            journeys=UNLIMITED,
            agents=UNLIMITED,
            ai=1_000,
            highlights=1,
        ),
        _AUTOMATION | {_ALL},
        "by_source",
    ),
    Plan.AGENCY: PlanSpec(
        Plan.AGENCY,
        49_900,
        True,
        _limits(
            users=5,
            properties=1_000,
            contacts=UNLIMITED,
            automation=15_000,
            journeys=UNLIMITED,
            agents=UNLIMITED,
            ai=3_000,
            highlights=3,
        ),
        _AGENCY | {_ALL},
        "by_broker",
        extra_user_cents=5_900,
    ),
}
# Legacy plans: existing workspaces only, never sold. `corretor` (R$ 99) was migrated to
# `essential` in migration 0016; these map to the closest current entitlements.
PLANS[Plan.CORRETOR] = PlanSpec(
    Plan.CORRETOR,
    9_900,
    False,
    PLANS[Plan.ESSENTIAL].limits,
    PLANS[Plan.ESSENTIAL].features,
    "basic",
    sellable=False,
)
PLANS[Plan.ESSENCIAL] = PlanSpec(
    Plan.ESSENCIAL,
    19_700,
    False,
    PLANS[Plan.AUTOMATION].limits,
    PLANS[Plan.AUTOMATION].features,
    "full",
    sellable=False,
)
PLANS[Plan.PROFISSIONAL] = PlanSpec(
    Plan.PROFISSIONAL,
    39_700,
    False,
    PLANS[Plan.PRO].limits,
    PLANS[Plan.PRO].features,
    "by_source",
    sellable=False,
)

SELLABLE: tuple[Plan, ...] = (Plan.FREE, Plan.ESSENTIAL, Plan.AUTOMATION, Plan.PRO, Plan.AGENCY)

ADD_ONS: tuple[AddOn, ...] = (
    AddOn("ai_conversations_500", 4_900, Meter.AI_CONVERSATIONS_MONTH, 500),
    AddOn("automation_contacts_1000", 3_900, Meter.AUTOMATION_CONTACTS_MONTH, 1_000),
    AddOn("agency_extra_user", 5_900, Meter.USERS, 1, frozenset({Plan.AGENCY})),
)

# Destaques: fixed price per property and period, in every plan (effective 21/11/2026).
HIGHLIGHT_EFFECTIVE_FROM = date(2026, 11, 21)
HIGHLIGHT_PACKAGES: dict[int, int] = {7: 3_900, 30: 11_900}
# Owner one-off listing (no CRM), separate from the plans.
OWNER_PACKAGES: dict[int, int] = {30: 5_900, 90: 14_900}

WARN_AT = 0.8  # warn at 80 %; at 100 % nothing is charged: automations pause, agents hand off


# Paid plans a broker can subscribe to on their own (Stripe Checkout, monthly).
CHECKOUT_PLANS: tuple[Plan, ...] = tuple(p for p in SELLABLE if p != Plan.FREE)


def price_lookup_key(plan: Plan, period: str = "monthly") -> str:
    """The Stripe price lookup key of a plan (`make stripe:sync` creates the prices)."""
    return f"casvitta_plan_{plan.value}_{period}"


def plan_from_lookup_key(lookup_key: str | None) -> Plan | None:
    """'casvitta_plan_automation_monthly' -> Plan.AUTOMATION; unknown keys -> None."""
    for plan in Plan:
        for period in ("monthly", "annual"):
            if lookup_key == price_lookup_key(plan, period):
                return plan
    return None


def paid_price_cents() -> dict[str, int]:
    """Monthly price per lookup key (fake payments adapter and the Stripe sync)."""
    return {price_lookup_key(p): PLANS[p].monthly_cents for p in CHECKOUT_PLANS}


def spec(plan: Plan) -> PlanSpec:
    return PLANS[plan]


def has_feature(plan: Plan, feature: Feature) -> bool:
    return feature in PLANS[plan].features


def limit(plan: Plan, meter: Meter) -> int | None:
    return PLANS[plan].limits[meter]


LimitState = Literal["ok", "warning", "reached", "not_included"]


def limit_state(plan: Plan, meter: Meter, used: int, extra: int = 0) -> LimitState:
    """ok < 80 % ≤ warning < 100 % ≤ reached. `extra` = add-on units bought this month."""
    cap = limit(plan, meter)
    if cap is None:
        return "ok"
    total = cap + extra
    if total == 0:
        return "not_included"
    if used >= total:
        return "reached"
    if used >= total * WARN_AT:
        return "warning"
    return "ok"


def allows_more(plan: Plan, meter: Meter, used: int, extra: int = 0) -> bool:
    """True while one more unit fits (creating a property, sending an automated message…)."""
    cap = limit(plan, meter)
    return cap is None or used + 1 <= cap + extra


# ------------------------------------------------------------------ public representation


class PlanOut(BaseModel):
    key: Plan
    monthly_cents: int
    annual_monthly_cents: int | None
    price_from: bool
    extra_user_cents: int | None
    limits: dict[Meter, int | None]
    features: list[Feature]
    reports: ReportLevel


class AddOnOut(BaseModel):
    key: str
    price_cents: int
    meter: Meter
    amount: int
    plans: list[Plan]


class PackageOut(BaseModel):
    days: int
    price_cents: int


class CatalogOut(BaseModel):
    version: str
    show_annual_prices: bool
    plans: list[PlanOut]
    add_ons: list[AddOnOut]
    highlight_effective_from: date
    highlight_packages: list[PackageOut]
    owner_packages: list[PackageOut]


def catalog_out(*, show_annual_prices: bool) -> CatalogOut:
    return CatalogOut(
        version=CATALOG_VERSION,
        show_annual_prices=show_annual_prices,
        plans=[
            PlanOut(
                key=p.key,
                monthly_cents=p.monthly_cents,
                annual_monthly_cents=p.annual_monthly_cents,
                price_from=p.price_from,
                extra_user_cents=p.extra_user_cents,
                limits=p.limits,
                features=sorted(p.features),
                reports=p.reports,
            )
            for p in (PLANS[k] for k in SELLABLE)
        ],
        add_ons=[
            AddOnOut(
                key=a.key,
                price_cents=a.price_cents,
                meter=a.meter,
                amount=a.amount,
                plans=sorted(a.plans),
            )
            for a in ADD_ONS
        ],
        highlight_effective_from=HIGHLIGHT_EFFECTIVE_FROM,
        highlight_packages=[
            PackageOut(days=d, price_cents=c) for d, c in HIGHLIGHT_PACKAGES.items()
        ],
        owner_packages=[PackageOut(days=d, price_cents=c) for d, c in OWNER_PACKAGES.items()],
    )
