from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.domains.contacts.models import (
    ConsentPurpose,
    ConsentStatus,
    ContactChannel,
    ContactKind,
    ContactSource,
    InterestSource,
    ProofSource,
    Purpose,
)
from app.domains.interest.schemas import normalize_br_phone


class InterestIn(BaseModel):
    purpose: Purpose
    neighborhoods: list[str] = Field(default_factory=list, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    property_kinds: list[str] = Field(default_factory=list, max_length=10)
    min_price_cents: int | None = Field(default=None, ge=0)
    max_price_cents: int | None = Field(default=None, ge=0)
    min_bedrooms: int | None = Field(default=None, ge=0, le=20)
    min_parking: int | None = Field(default=None, ge=0, le=20)
    source: InterestSource = InterestSource.BROKER


class InterestOut(InterestIn):
    id: uuid.UUID


class ContactConsentIn(BaseModel):
    """A consent the person gave. Never pre-checked: the client sends it only when ticked."""

    channel: ContactChannel
    purpose: ConsentPurpose
    granted: bool
    proof_source: ProofSource
    proof_location: str | None = Field(default=None, max_length=300)
    proof_text: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _proof(self) -> ContactConsentIn:
        if self.granted and self.proof_source == ProofSource.FORM and not self.proof_text:
            raise ValueError("a form consent needs the text shown")
        return self


class ConsentState(BaseModel):
    channel: ContactChannel
    purpose: ConsentPurpose
    status: ConsentStatus | None  # None = never asked
    occurred_at: datetime | None
    proof_source: ProofSource | None
    proof_location: str | None


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=254)
    instagram_handle: str | None = Field(default=None, max_length=60)
    kind: ContactKind = ContactKind.UNKNOWN
    source: ContactSource = ContactSource.MANUAL
    source_detail: str | None = Field(default=None, max_length=160)
    utm_source: str | None = Field(default=None, max_length=120)
    utm_medium: str | None = Field(default=None, max_length=120)
    utm_campaign: str | None = Field(default=None, max_length=120)
    property_id: uuid.UUID | None = None
    interest: InterestIn | None = None
    consents: list[ContactConsentIn] = Field(default_factory=list, max_length=6)

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

    @field_validator("instagram_handle")
    @classmethod
    def _handle(cls, value: str | None) -> str | None:
        return value.strip().lstrip("@").lower() or None if value else None


class ContactPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=254)
    instagram_handle: str | None = Field(default=None, max_length=60)
    kind: ContactKind | None = None
    responsible_user_id: uuid.UUID | None = None

    _phone = field_validator("phone")(ContactIn._phone.__func__)  # type: ignore[attr-defined]
    _email = field_validator("email")(ContactIn._email.__func__)  # type: ignore[attr-defined]


class ConsentSummary(BaseModel):
    """Per channel, for the list: granted / none / revoked (asked to leave)."""

    whatsapp: Literal["granted", "none", "revoked"]
    instagram: Literal["granted", "none", "revoked"]
    email: Literal["granted", "none", "revoked"]


class StageRef(BaseModel):
    id: uuid.UUID
    key: str | None
    name: str | None


class ContactRow(BaseModel):
    id: uuid.UUID
    name: str
    kind: ContactKind
    source: ContactSource
    source_detail: str | None
    interest: InterestOut | None
    stage: StageRef | None
    consent: ConsentSummary
    last_interaction_at: datetime | None
    is_demo: bool


# "page" = Interessados: people who came through the broker page forms (Casvitta Social).
ContactView = Literal["all", "buyers", "tenants", "owners", "no_reply_14d", "page"]


class ContactListOut(BaseModel):
    items: list[ContactRow]
    counts: dict[str, int]


class ContactTimelineItem(BaseModel):
    at: datetime
    kind: Literal["message", "event", "note", "visit"]
    channel: str | None
    author: str | None
    text: str
    ref: str | None = None


class MatchingProperty(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    price_cents: int
    within_budget: bool


class LeadSummary(BaseModel):
    id: uuid.UUID
    stage: StageRef
    property_code: str | None
    automations_paused: bool


class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    due_at: datetime | None
    done_at: datetime | None


class Contact360(BaseModel):
    id: uuid.UUID
    name: str
    phone_e164: str | None
    email: str | None
    instagram_handle: str | None
    kind: ContactKind
    source: ContactSource
    source_detail: str | None
    responsible_user_id: uuid.UUID | None
    is_demo: bool
    interests: list[InterestOut]
    consents: list[ConsentState]
    leads: list[LeadSummary]
    tasks: list[TaskOut]
    timeline: list[ContactTimelineItem]
    matching_properties: list[MatchingProperty]


class ContactNoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    due_at: datetime | None = None


class MatchingContact(BaseModel):
    person_id: uuid.UUID
    name: str
    interest: InterestOut
    within_budget: bool
    consent: ConsentSummary
