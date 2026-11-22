from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.domains.accounts.schemas import CreciStatus
from app.domains.interest.schemas import normalize_br_phone
from app.domains.pages.models import PageEventKind, PageSource, PageStatus, PageTheme, WorksAs
from app.domains.properties.schemas import PublicListingOut

PageBlocker = Literal[
    "display_name_missing", "whatsapp_missing", "creci_missing", "creci_unverified"
]


class PageChecklist(BaseModel):
    """Visão geral (mockup social/11): what is done towards a page that works."""

    profile_photo: bool
    bio: bool
    creci_verified: bool
    has_properties: bool
    published: bool
    link_used: bool  # at least one visit


class PageOut(BaseModel):
    slug: str
    url: str
    # Earlier addresses that still lead here (oldest first).
    old_slugs: list[str]
    theme: PageTheme
    works_as: WorksAs
    agency_name: str | None
    status: PageStatus
    # True when anyone can open the page now (published and, if required, CRECI verified).
    is_live: bool
    published_at: datetime | None
    suspended_reason: str | None
    onboarding_step: int
    onboarding_done: bool
    onboarding_dismissed: bool
    display_name: str
    photo_url: str | None
    bio: str | None
    regions: list[str]
    whatsapp_e164: str | None
    creci: str | None  # "CRECI-SP 000.000-F"
    creci_status: CreciStatus
    # Why "Publicar" cannot run now (empty = can publish).
    blockers: list[PageBlocker]
    checklist: PageChecklist
    # Branded footer "Crie sua página com a Casvitta" (plans without unbranded_page).
    branded: bool
    # Finder and owner form on the page (plans with tracked_forms).
    forms: bool


class PageUpdate(BaseModel):
    theme: PageTheme | None = None
    works_as: WorksAs | None = None
    agency_name: str | None = Field(default=None, max_length=120)
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    bio: str | None = Field(default=None, max_length=600)
    regions: list[str] | None = Field(default=None, max_length=12)
    whatsapp: str | None = None
    onboarding_step: int | None = Field(default=None, ge=2, le=9)
    onboarding_done: bool | None = None
    onboarding_dismissed: bool | None = None

    @field_validator("whatsapp")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return normalize_br_phone(value) if value else None

    @field_validator("regions")
    @classmethod
    def _regions(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [r.strip()[:80] for r in value if r.strip()]
        return list(dict.fromkeys(cleaned))


class PublicCollectionOut(BaseModel):
    title: str
    codes: list[str]  # only properties live on the page, in the broker's order


class PublicInstagramPostOut(BaseModel):
    url: str
    label: str
    code: str


class PublicPageOut(BaseModel):
    """What anyone sees on {slug}.casvitta.com.br. No email, no owner data."""

    # The current address; differs from the requested one when an old address was used.
    slug: str
    url: str
    theme: PageTheme
    display_name: str
    works_as: WorksAs
    agency_name: str | None
    photo_url: str | None
    bio: str | None
    regions: list[str]
    whatsapp_e164: str | None
    creci: str | None
    creci_verified: bool
    branded: bool
    is_demo: bool
    # Finder ("Encontre um imóvel para mim") and the owner form (plans with tracked_forms).
    forms: bool
    # Only with a verified CRECI and a staff-checked owner authorization (rules 1 and 2).
    properties: list[PublicListingOut]
    # Seleções and "Vi no Instagram" (plans with page_collections); empty otherwise.
    collections: list[PublicCollectionOut] = []
    instagram: list[PublicInstagramPostOut] = []


class PageEventIn(BaseModel):
    kind: PageEventKind
    source: PageSource = PageSource.LINK
    property_code: str | None = Field(default=None, max_length=16, pattern=r"^CV-\d{1,10}$")


class PageStatsOut(BaseModel):
    """Resultados: last `days` days. A WhatsApp click is a click, not a message or a lead."""

    days: int
    page_views: int
    property_views: int
    whatsapp_clicks: int
    forms_submitted: int
    by_source: dict[PageSource, int]


class SlugCheckOut(BaseModel):
    slug: str
    url: str
    # None = available; otherwise why not ("same" = already the page address).
    problem: Literal["invalid", "reserved", "taken", "same", "too_many_changes"] | None


class SlugChangeIn(BaseModel):
    slug: str = Field(min_length=1, max_length=63)

    @field_validator("slug")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.strip().lower()
