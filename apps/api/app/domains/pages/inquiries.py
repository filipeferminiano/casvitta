"""Forms on the broker page (mockup social/03): "Encontre um imóvel para mim" (finder) and
"Quero vender ou alugar meu imóvel" (owner form).

Both land in the broker's CRM as the same records every other door uses (CLAUDE.md: never
duplicate data between modules): the person (merged by phone or email), the consent with the text
shown (never pre-checked), what they look for or offer, a lead in "Novo" and a system note with
the request. That is what Interessados lists. Only what the person typed is stored; no CPF and no
financial documents are asked.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import Feature
from app.core.errors import AppError
from app.core.i18n import translate
from app.core.money import format_brl
from app.core.settings import Settings
from app.core.tenancy import bind_workspace, cross_tenant
from app.domains.activity.models import EventActor
from app.domains.contacts import service as contacts
from app.domains.contacts.models import (
    ConsentPurpose,
    ContactChannel,
    ContactKind,
    ContactNote,
    ContactSource,
    InterestSource,
    ProofSource,
    Purpose,
)
from app.domains.contacts.schemas import ContactConsentIn, ContactIn, InterestIn
from app.domains.interest.schemas import normalize_br_phone
from app.domains.pages import service as pages
from app.domains.pages.models import PageEventKind, PageSource
from app.domains.properties.models import PropertyKind

InquiryKind = Literal["finder", "owner"]
ContactPreference = Literal["whatsapp", "call", "email"]

_KIND_BY_PURPOSE = {
    Purpose.BUY: ContactKind.BUYER,
    Purpose.RENT: ContactKind.TENANT,
    Purpose.SELL: ContactKind.OWNER,
    Purpose.LET: ContactKind.OWNER,
}


class PageInquiryIn(BaseModel):
    kind: InquiryKind
    purpose: Purpose
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=254)
    # "Aceito ser contatado pela Mariana sobre imóveis" (unchecked, required).
    consent: bool = False
    consent_text: str = Field(min_length=10, max_length=2000)
    page_url: str = Field(max_length=300)
    source: PageSource = PageSource.LINK
    utm_source: str | None = Field(default=None, max_length=120)
    utm_medium: str | None = Field(default=None, max_length=120)
    utm_campaign: str | None = Field(default=None, max_length=120)
    # Finder answers (and the owner's neighborhood).
    city: str | None = Field(default=None, max_length=120)
    neighborhoods: list[str] = Field(default_factory=list, max_length=12)
    property_kinds: list[PropertyKind] = Field(default_factory=list, max_length=5)
    min_price_cents: int | None = Field(default=None, ge=0)
    max_price_cents: int | None = Field(default=None, ge=0)
    min_bedrooms: int | None = Field(default=None, ge=0, le=10)
    # Codes the finder showed ("2 imóveis combinam com você"), for the broker's note.
    matched_codes: list[str] = Field(default_factory=list, max_length=20)
    # Owner form.
    details: str | None = Field(default=None, max_length=1000)
    contact_preference: ContactPreference = "whatsapp"

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return normalize_br_phone(value) if value else None

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("invalid_email")
        return value

    @field_validator("neighborhoods")
    @classmethod
    def _neighborhoods(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(n.strip()[:80] for n in value if n.strip()))

    @field_validator("matched_codes")
    @classmethod
    def _codes(cls, value: list[str]) -> list[str]:
        return [c for c in value if c.startswith("CV-") and c[3:].isdigit()]

    @model_validator(mode="after")
    def _rules(self) -> PageInquiryIn:
        buyer = self.purpose in {Purpose.BUY, Purpose.RENT}
        if (self.kind == "finder") != buyer:
            raise ValueError("finder is for buy/rent, the owner form for sell/let")
        if not self.phone and not self.email:
            raise ValueError("phone or email is required")
        if not self.consent:
            raise ValueError("consent is required to be contacted")
        if self.contact_preference in {"whatsapp", "call"} and not self.phone:
            raise ValueError("this contact preference needs a phone")
        if self.contact_preference == "email" and not self.email:
            raise ValueError("this contact preference needs an email")
        if self.kind == "owner" and not self.city:
            raise ValueError("the owner form needs the city")
        return self


class PageInquiryAccepted(BaseModel):
    status: str = "received"


def _consents(data: PageInquiryIn) -> list[ContactConsentIn]:
    channels = [
        channel
        for value, channel in (
            (data.phone, ContactChannel.WHATSAPP),
            (data.email, ContactChannel.EMAIL),
        )
        if value
    ]
    return [
        ContactConsentIn(
            channel=channel,
            purpose=ConsentPurpose.CONTACT_ABOUT_PROPERTIES,
            granted=True,
            proof_source=ProofSource.FORM,
            proof_location=data.page_url,
            proof_text=data.consent_text,
        )
        for channel in channels
    ]


def _budget(data: PageInquiryIn) -> str | None:
    low, high = data.min_price_cents, data.max_price_cents
    if low and high:
        return translate("inquiry.budget_range", {"low": format_brl(low), "high": format_brl(high)})
    if high:
        return translate("inquiry.budget_up_to", {"high": format_brl(high)})
    if low:
        return translate("inquiry.budget_from", {"low": format_brl(low)})
    return None


def source_label(source: PageSource) -> str:
    return translate(f"page_source.{source.value}")


def summary(data: PageInquiryIn) -> str:
    """The note the broker reads in Interessados (pt-BR, only what the person answered)."""
    parts = [translate(f"inquiry.purpose.{data.purpose.value}")]
    if data.property_kinds:
        parts.append(", ".join(translate(f"inquiry.kind.{k.value}") for k in data.property_kinds))
    place = ", ".join([*data.neighborhoods, *([data.city] if data.city else [])])
    if place:
        parts.append(place)
    budget = _budget(data)
    if budget:
        parts.append(budget)
    if data.min_bedrooms:
        parts.append(translate("inquiry.bedrooms", {"n": data.min_bedrooms}))
    lines = [
        translate(f"inquiry.title.{data.kind}", {"source": source_label(data.source)}),
        " · ".join(parts) + ".",
        translate(f"inquiry.preference.{data.contact_preference}"),
    ]
    if data.matched_codes:
        lines.append(translate("inquiry.matched", {"codes": ", ".join(data.matched_codes)}))
    if data.details:
        lines.append(translate("inquiry.details", {"details": data.details.strip()}))
    return "\n".join(lines)


async def submit(
    session: AsyncSession,
    slug: str,
    data: PageInquiryIn,
    *,
    client: str,
    user_agent: str,
    settings: Settings,
) -> PageInquiryAccepted:
    found = await pages.live_page(session, slug, settings)
    if found is None:
        raise pages.PageNotFound
    page, _ = found
    with cross_tenant(session):
        allowed = await pages.plan_has(session, page.workspace_id, Feature.TRACKED_FORMS)
    if not allowed:
        raise AppError("feature_not_in_plan", status_code=403)
    bind_workspace(session, page.workspace_id)
    finder = data.kind == "finder"
    person, _ = await contacts.upsert_contact(
        session,
        ContactIn(
            name=data.name,
            phone=data.phone,
            email=data.email,
            kind=_KIND_BY_PURPOSE[data.purpose],
            source=ContactSource.FINDER if finder else ContactSource.OWNER_FORM,
            source_detail=source_label(data.source),
            utm_source=data.utm_source,
            utm_medium=data.utm_medium,
            utm_campaign=data.utm_campaign,
            interest=InterestIn(
                purpose=data.purpose,
                neighborhoods=data.neighborhoods,
                city=data.city,
                property_kinds=[k.value for k in data.property_kinds],
                min_price_cents=data.min_price_cents,
                max_price_cents=data.max_price_cents,
                min_bedrooms=data.min_bedrooms,
                source=InterestSource.FORM,
            ),
            consents=_consents(data),
        ),
        actor=EventActor.CONTACT,
    )
    session.add(ContactNote(person_id=person.id, author_user_id=None, body=summary(data)))
    if not pages.is_bot(user_agent):
        await pages.insert_event(
            session,
            page,
            kind=PageEventKind.FORM_SUBMITTED,
            source=data.source,
            property_code=None,
            key=pages.visitor_key(client, user_agent, settings),
        )
    await session.flush()
    return PageInquiryAccepted()
