"""Request/response schemas for interest signups. Criteria are validated per kind."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domains.interest.models import InterestKind, InterestStatus

_DIGITS = re.compile(r"\D")


def normalize_br_phone(value: str) -> str:
    """'(11) 92740-8912' or '+55 11 92740-8912' -> '+5511927408912'. Raises ValueError otherwise."""
    stripped = value.strip()
    if stripped.startswith("+") and not stripped.replace(" ", "").startswith("+55"):
        raise ValueError("invalid_phone")
    digits = _DIGITS.sub("", stripped)
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
    if len(digits) not in (10, 11) or digits[0] == "0":
        raise ValueError("invalid_phone")
    return f"+55{digits}"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------------------------------------------------------------- criteria per kind


class PropertyKind(StrEnum):
    APARTMENT = "apartment"
    HOUSE = "house"
    LAND = "land"
    COMMERCIAL = "commercial"


class AgencyCriteria(Strict):
    company: str = Field(min_length=2, max_length=120)
    brokers_count: int | None = Field(default=None, ge=1, le=5000)
    city: str | None = Field(default=None, max_length=120)


class OwnerListingCriteria(Strict):
    transaction: Literal["sale", "rent"]
    cep: str
    property_kind: PropertyKind
    bedrooms: int | None = Field(default=None, ge=0, le=20)
    area_m2: int | None = Field(default=None, ge=10, le=100_000)
    # Owner's own idea of the price; the broker brings a valuation with comparables.
    expected_price_cents: int | None = Field(default=None, ge=0)

    @field_validator("cep")
    @classmethod
    def _cep(cls, value: str) -> str:
        digits = _DIGITS.sub("", value)
        if len(digits) != 8:
            raise ValueError("invalid_cep")
        return digits


class OwnerListingStartCriteria(Strict):
    """First step of an owner's own listing (/anunciar-imovel). Nothing is charged or published."""

    transaction: Literal["sale", "rent"]
    property_kind: PropertyKind
    city: str = Field(min_length=2, max_length=120)
    # Pack chosen on the page, if any (30 or 90 days); the period is confirmed on WhatsApp.
    period_days: Literal[30, 90] | None = None


class TeamSize(StrEnum):
    FROM_1_TO_5 = "1_5"
    FROM_6_TO_15 = "6_15"
    OVER_15 = "16_plus"


class ActivePropertiesRange(StrEnum):
    UP_TO_200 = "up_to_200"
    FROM_201_TO_500 = "201_to_500"
    OVER_500 = "over_500"


class AgencyDemoCriteria(Strict):
    company: str = Field(min_length=2, max_length=120)
    team_size: TeamSize
    active_properties: ActivePropertiesRange


class DeveloperCriteria(Strict):
    company: str = Field(min_length=2, max_length=120)
    role: str | None = Field(default=None, max_length=80)
    cities: list[str] = Field(min_length=1, max_length=20)
    launches_per_year: int | None = Field(default=None, ge=0, le=1000)


class InstitutionalType(StrEnum):
    FII_MANAGER = "fii_manager"
    FAMILY_OFFICE = "family_office"
    SECURITIZER = "securitizer"
    OWN_PORTFOLIO = "own_portfolio"
    OTHER = "other"


class PortfolioSize(StrEnum):
    UP_TO_10 = "up_to_10"
    FROM_11_TO_50 = "11_to_50"
    FROM_51_TO_200 = "51_to_200"
    OVER_200 = "over_200"


class InstitutionalFront(StrEnum):
    OPERATIONS = "operations"
    LEASING = "leasing"
    TENANT_RISK = "tenant_risk"
    ORIGINATION = "origination"
    DATA = "data"


class InvestorInstitutionalCriteria(Strict):
    company: str = Field(min_length=2, max_length=120)
    org_type: InstitutionalType
    portfolio_size: PortfolioSize
    cities: list[str] = Field(min_length=1, max_length=20)
    interests: list[InstitutionalFront] = Field(min_length=1)


class RentalAdminCriteria(Strict):
    city: str | None = Field(default=None, max_length=120)
    properties_count: int | None = Field(default=None, ge=1, le=10_000)


class AuctionPriceRange(StrEnum):
    UP_TO_300K = "up_to_300k"
    FROM_300K_TO_600K = "300k_to_600k"
    FROM_600K_TO_1M = "600k_to_1m"
    OVER_1M = "over_1m"


class AuctionCriteria(Strict):
    regions: str = Field(min_length=2, max_length=200)
    property_kinds: list[PropertyKind] = Field(min_length=1)
    price_range: AuctionPriceRange
    payment: Literal["cash", "financing", "unsure"]
    purpose: Literal["live", "invest"]
    has_participated: bool


# ---------------------------------------------------------------- request / response


class ConsentIn(Strict):
    contact_about_properties: bool
    marketing: bool = False


class Utm(Strict):
    source: str | None = Field(default=None, max_length=80)
    medium: str | None = Field(default=None, max_length=80)
    campaign: str | None = Field(default=None, max_length=120)


class _SignupBase(Strict):
    name: str = Field(min_length=2, max_length=120)
    phone: str
    email: str | None = Field(default=None, max_length=254)
    consents: ConsentIn
    utm: Utm = Field(default_factory=Utm)
    source_page: str | None = Field(default=None, max_length=200)
    # Honeypot: real users never see or fill it.
    website: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalize_br_phone(value)


class AgencySignup(_SignupBase):
    kind: Literal[InterestKind.AGENCY]
    criteria: AgencyCriteria


class OwnerListingSignup(_SignupBase):
    kind: Literal[InterestKind.OWNER_LISTING]
    criteria: OwnerListingCriteria


class OwnerListingStartSignup(_SignupBase):
    kind: Literal[InterestKind.OWNER_LISTING_START]
    criteria: OwnerListingStartCriteria


class AgencyDemoSignup(_SignupBase):
    kind: Literal[InterestKind.AGENCY_DEMO]
    criteria: AgencyDemoCriteria
    # The demo invite goes by email, so it is required here.
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class DeveloperSignup(_SignupBase):
    kind: Literal[InterestKind.DEVELOPER]
    criteria: DeveloperCriteria


class InvestorInstitutionalSignup(_SignupBase):
    kind: Literal[InterestKind.INVESTOR_INSTITUTIONAL]
    criteria: InvestorInstitutionalCriteria


class RentalAdminSignup(_SignupBase):
    kind: Literal[InterestKind.RENTAL_ADMIN]
    criteria: RentalAdminCriteria


class AuctionSignup(_SignupBase):
    kind: Literal[InterestKind.AUCTION]
    criteria: AuctionCriteria


InterestSignupIn = Annotated[
    AgencySignup
    | OwnerListingSignup
    | DeveloperSignup
    | InvestorInstitutionalSignup
    | RentalAdminSignup
    | AuctionSignup
    | OwnerListingStartSignup
    | AgencyDemoSignup,
    Field(discriminator="kind"),
]


OptInResult = Literal["whatsapp_sent", "queued", "not_requested"]


class InterestSignupAccepted(BaseModel):
    """Same body for stored and honeypot-rejected requests, so bots learn nothing."""

    status: Literal["accepted"] = "accepted"
    # queued: stored, but no WhatsApp adapter delivers yet; the opt-in goes out later.
    opt_in: OptInResult


class InterestSignupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: InterestKind
    name: str
    phone_e164: str
    email: str | None
    criteria: dict[str, object]
    status: InterestStatus
    source_page: str | None
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    created_at: datetime
    opt_in_confirmed_at: datetime | None
