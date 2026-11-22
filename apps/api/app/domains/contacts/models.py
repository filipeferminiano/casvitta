"""Contacts (CLAUDE.md `people`): buyers, tenants and owners of one workspace, with what they look
for and consent per channel and purpose (rule 8). A contact belongs to the broker: staff see counts
only (opening one needs a registered support request, audited).

Duplicates are merged by phone or email, never by an Instagram handle alone.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum


class ContactKind(StrEnum):
    BUYER = "buyer"
    TENANT = "tenant"
    OWNER = "owner"  # wants to sell or let
    UNKNOWN = "unknown"


class ContactSource(StrEnum):
    BROKER_PAGE = "broker_page"  # {slug}.casvitta.com.br forms
    LISTING_PAGE = "listing_page"  # casvitta.com.br/imovel/… (portal)
    FINDER = "finder"  # "Encontre um imóvel para mim"
    OWNER_FORM = "owner_form"
    INSTAGRAM = "instagram"
    WHATSAPP = "whatsapp"
    QR_SIGN = "qr_sign"  # Placa
    IMPORT = "import"
    MANUAL = "manual"


class Person(UUIDPrimaryKey, Timestamps, WorkspaceScoped, DemoFlag, Base):
    __tablename__ = "people"
    __table_args__ = (
        Index(
            "uq_people_workspace_phone",
            "workspace_id",
            "phone_e164",
            unique=True,
            postgresql_where=text("phone_e164 IS NOT NULL"),
        ),
        Index(
            "uq_people_workspace_email",
            "workspace_id",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(String(160))
    # Only what the person provided; never inferred from a social identity.
    phone_e164: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(254))
    instagram_handle: Mapped[str | None] = mapped_column(String(60))
    kind: Mapped[ContactKind] = mapped_column(
        str_enum(ContactKind), default=ContactKind.UNKNOWN, server_default="unknown"
    )
    source: Mapped[ContactSource] = mapped_column(str_enum(ContactSource))
    source_detail: Mapped[str | None] = mapped_column(String(160))  # "Reel Cambuí", "CV-204"
    utm_source: Mapped[str | None] = mapped_column(String(120))
    utm_medium: Mapped[str | None] = mapped_column(String(120))
    utm_campaign: Mapped[str | None] = mapped_column(String(120))
    responsible_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    last_interaction_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Purpose(StrEnum):
    BUY = "buy"
    RENT = "rent"
    SELL = "sell"
    LET = "let"


class InterestSource(StrEnum):
    FORM = "form"
    CONVERSATION = "conversation"
    BROKER = "broker"


class ContactInterest(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    """What the contact looks for (or offers), as they said it."""

    __tablename__ = "contact_interests"

    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[Purpose] = mapped_column(str_enum(Purpose))
    neighborhoods: Mapped[list[str]] = mapped_column(
        ARRAY(String(120)), default=list, server_default="{}"
    )
    city: Mapped[str | None] = mapped_column(String(120))
    property_kinds: Mapped[list[str]] = mapped_column(
        ARRAY(String(32)), default=list, server_default="{}"
    )
    min_price_cents: Mapped[int | None] = mapped_column(Integer)
    max_price_cents: Mapped[int | None] = mapped_column(Integer)
    min_bedrooms: Mapped[int | None] = mapped_column(Integer)
    min_parking: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[InterestSource] = mapped_column(str_enum(InterestSource))


class ContactChannel(StrEnum):
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    EMAIL = "email"


class ConsentPurpose(StrEnum):
    CONTACT_ABOUT_PROPERTIES = "contact_about_properties"
    MARKETING = "marketing"


class ConsentStatus(StrEnum):
    GRANTED = "granted"
    REVOKED = "revoked"


class ProofSource(StrEnum):
    FORM = "form"  # a checkbox the person ticked (never pre-checked)
    CONVERSATION = "conversation"  # the person started or agreed in a conversation
    BROKER = "broker"  # recorded by the broker, who answers for it
    OPT_OUT = "opt_out"  # "SAIR" or an unsubscribe


class Consent(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    """Consent per channel × purpose, with proof: who, when, where, and the exact text shown.

    History is append-only: a change adds a row; the newest row per (person, channel, purpose)
    is the current status.
    """

    __tablename__ = "consents"
    __table_args__ = (
        Index("ix_consents_person_channel_purpose", "person_id", "channel", "purpose"),
    )

    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[ContactChannel] = mapped_column(str_enum(ContactChannel, name="channel"))
    purpose: Mapped[ConsentPurpose] = mapped_column(str_enum(ConsentPurpose))
    status: Mapped[ConsentStatus] = mapped_column(str_enum(ConsentStatus))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    proof_source: Mapped[ProofSource] = mapped_column(str_enum(ProofSource))
    proof_location: Mapped[str | None] = mapped_column(String(300))  # URL or conversation id
    proof_text: Mapped[str | None] = mapped_column(Text)  # the text shown at the checkbox
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class ContactNote(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "contact_notes"

    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    body: Mapped[str] = mapped_column(Text)
