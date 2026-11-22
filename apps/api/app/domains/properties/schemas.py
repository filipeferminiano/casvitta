from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domains.listings.models import Channel, ListingStatus, UnpublishReason
from app.domains.listings.rules import Blocker
from app.domains.properties.models import (
    AuthorizationEvidence,
    AuthorizationReview,
    PropertyKind,
    PropertySource,
    PropertyStatus,
    SyncStatus,
    Transaction,
)

Cents = int


class PropertyIn(BaseModel):
    kind: PropertyKind
    transaction: Transaction
    title: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    street: str | None = Field(default=None, max_length=160)
    show_street: bool = False
    street_number: str | None = Field(default=None, max_length=16)
    complement: str | None = Field(default=None, max_length=80)
    postal_code: str | None = Field(default=None, pattern=r"^\d{5}-?\d{3}$")
    neighborhood: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=120)
    state: str = Field(pattern=r"^[A-Z]{2}$")
    area_m2: int | None = Field(default=None, ge=1, le=100_000)
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    bathrooms: int | None = Field(default=None, ge=0, le=50)
    suites: int | None = Field(default=None, ge=0, le=50)
    floor: int | None = Field(default=None, ge=-5, le=200)
    parking: int | None = Field(default=None, ge=0, le=50)
    features: list[str] = Field(default_factory=list, max_length=40)
    price_cents: Cents = Field(ge=0)
    # None = "Não informado" on public pages; never sent as 0 for "unknown".
    condo_fee_cents: Cents | None = Field(default=None, ge=0)
    iptu_monthly_cents: Cents | None = Field(default=None, ge=0)
    source: PropertySource = PropertySource.CASVITTA
    responsible_broker_id: uuid.UUID | None = None


class PropertyPatch(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    show_street: bool | None = None
    area_m2: int | None = Field(default=None, ge=1, le=100_000)
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    bathrooms: int | None = Field(default=None, ge=0, le=50)
    suites: int | None = Field(default=None, ge=0, le=50)
    floor: int | None = Field(default=None, ge=-5, le=200)
    parking: int | None = Field(default=None, ge=0, le=50)
    features: list[str] | None = Field(default=None, max_length=40)
    price_cents: Cents | None = Field(default=None, ge=0)
    condo_fee_cents: Cents | None = Field(default=None, ge=0)
    iptu_monthly_cents: Cents | None = Field(default=None, ge=0)
    status: PropertyStatus | None = None


class AuthorizationIn(BaseModel):
    kind: Transaction
    exclusive: bool = False
    evidence: AuthorizationEvidence
    owner_name: str = Field(min_length=2, max_length=160)
    signed_at: date
    expires_at: date
    # Attestation: the broker confirms, signed in, that they hold the owner's authorization.
    attest: bool = False

    @model_validator(mode="after")
    def _check(self) -> AuthorizationIn:
        if self.expires_at < self.signed_at:
            raise ValueError("expires_at must be on or after signed_at")
        if self.evidence == AuthorizationEvidence.ATTESTATION and not self.attest:
            raise ValueError("attestation requires attest=true")
        return self


class AuthorizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: Transaction
    exclusive: bool
    evidence: AuthorizationEvidence
    owner_name: str
    signed_at: date
    expires_at: date
    has_document: bool
    revoked_at: datetime | None
    review_status: AuthorizationReview
    review_reason: str | None


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    channel: Channel
    status: ListingStatus
    published_at: datetime | None
    unpublished_at: datetime | None
    unpublish_reason: UnpublishReason | None


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    position: int
    is_cover: bool


class PropertyOut(BaseModel):
    id: uuid.UUID
    code: str
    slug: str
    kind: PropertyKind
    transaction: Transaction
    status: PropertyStatus
    source: PropertySource
    title: str | None
    description: str | None
    street: str | None
    show_street: bool
    street_number: str | None
    complement: str | None
    postal_code: str | None
    neighborhood: str
    city: str
    state: str
    area_m2: int | None
    bedrooms: int | None
    bathrooms: int | None
    suites: int | None
    floor: int | None
    parking: int | None
    features: list[str]
    price_cents: Cents
    condo_fee_cents: Cents | None
    iptu_monthly_cents: Cents | None
    responsible_broker_id: uuid.UUID | None
    sync_status: SyncStatus | None
    last_synced_at: datetime | None
    is_demo: bool
    authorization: AuthorizationOut | None
    listings: list[ListingOut]
    media: list[MediaOut]
    # Why the property cannot be published now (empty = publishable).
    blockers: list[Blocker]


class PublicBroker(BaseModel):
    display_name: str
    slug: str
    creci_state: str
    creci_number: str
    photo_url: str | None


class PublicListingOut(BaseModel):
    """What anyone can see. Neighborhood-level location only; no owner data."""

    code: str
    slug: str
    kind: PropertyKind
    transaction: Transaction
    title: str | None
    description: str | None
    street: str | None  # only when the broker allows it
    neighborhood: str
    city: str
    state: str
    area_m2: int | None
    bedrooms: int | None
    bathrooms: int | None
    suites: int | None
    floor: int | None
    parking: int | None
    features: list[str]
    price_cents: Cents
    condo_fee_cents: Cents | None
    iptu_monthly_cents: Cents | None
    photos: list[str]
    broker: PublicBroker
    published_at: datetime | None
