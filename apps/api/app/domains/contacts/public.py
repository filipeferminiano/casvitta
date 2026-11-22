"""Public contact form on casvitta.com.br/imovel/… (and later broker pages).

The contact goes to the broker's workspace: person (merged by phone or email), consent with the
exact text shown (never pre-checked), a lead on that property, and the message in the inbox as a
"page" conversation. A click on WhatsApp is not this: it is never recorded as a message or a lead.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.tenancy import bind_workspace
from app.domains.activity.models import EventActor
from app.domains.contacts import service as contacts
from app.domains.contacts.models import (
    Channel,
    ConsentPurpose,
    ContactKind,
    ContactSource,
    ProofSource,
)
from app.domains.contacts.schemas import ConsentIn, ContactIn
from app.domains.conversations import service as conversations
from app.domains.conversations.models import ConversationChannel
from app.domains.interest.schemas import normalize_br_phone
from app.domains.leads import service as leads
from app.domains.properties import service as properties
from app.domains.properties.models import Transaction


class PublicContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=254)
    message: str = Field(min_length=1, max_length=2000)
    # The person ticked "Aceito receber contato sobre imóveis por WhatsApp/e-mail" (unchecked).
    consent_whatsapp: bool = False
    consent_email: bool = False
    # Exact consent text the page showed (stored as proof).
    consent_text: str = Field(min_length=10, max_length=2000)
    page_url: str = Field(max_length=300)
    utm_source: str | None = Field(default=None, max_length=120)
    utm_medium: str | None = Field(default=None, max_length=120)
    utm_campaign: str | None = Field(default=None, max_length=120)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return normalize_br_phone(value) if value else None

    @model_validator(mode="after")
    def _reachable(self) -> PublicContactIn:
        if not self.phone and not self.email:
            raise ValueError("phone or email is required")
        if not (self.consent_whatsapp or self.consent_email):
            raise ValueError("consent is required to be contacted")
        if self.consent_whatsapp and not self.phone:
            raise ValueError("WhatsApp consent needs a phone")
        if self.consent_email and not self.email:
            raise ValueError("email consent needs an email")
        return self


class PublicContactAccepted(BaseModel):
    status: str = "received"


async def submit_listing_contact(
    session: AsyncSession, slug: str, data: PublicContactIn, *, include_demo: bool
) -> PublicContactAccepted:
    prop = await properties.public_property_for_contact(session, slug, include_demo=include_demo)
    if prop is None:
        raise AppError("not_found", status_code=404)
    bind_workspace(session, prop.workspace_id)
    consents = []
    for granted, channel in (
        (data.consent_whatsapp, Channel.WHATSAPP),
        (data.consent_email, Channel.EMAIL),
    ):
        if granted:
            consents.append(
                ConsentIn(
                    channel=channel,
                    purpose=ConsentPurpose.CONTACT_ABOUT_PROPERTIES,
                    granted=True,
                    proof_source=ProofSource.FORM,
                    proof_location=data.page_url,
                    proof_text=data.consent_text,
                )
            )
    person, _ = await contacts.upsert_contact(
        session,
        ContactIn(
            name=data.name,
            phone=data.phone,
            email=data.email,
            kind=ContactKind.BUYER if prop.transaction == Transaction.SALE else ContactKind.TENANT,
            source=ContactSource.LISTING_PAGE,
            source_detail=prop.code,
            utm_source=data.utm_source,
            utm_medium=data.utm_medium,
            utm_campaign=data.utm_campaign,
            property_id=prop.id,
            consents=consents,
        ),
        actor=EventActor.CONTACT,
    )
    lead = await leads.open_lead(
        session, person, property_id=prop.id, source=ContactSource.LISTING_PAGE.value
    )
    conversation = await conversations.get_or_open(
        session, person, ConversationChannel.PAGE, lead_id=lead.id
    )
    await conversations.record_inbound(session, conversation, data.message)
    return PublicContactAccepted()
