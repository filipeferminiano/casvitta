"""Properties: the one record every module reads (CLAUDE.md §1, §5).

Public location is the neighborhood only; street number, complement, postal code and coordinates
stay private to the workspace. Missing recurring costs stay NULL and render "Não informado":
never 0, never invented.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Sequence,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum

# Platform-wide property code, shown as "CV-204" on pages, QR codes and support.
property_code_seq = Sequence("property_code_seq", start=100)


class PropertyKind(StrEnum):
    APARTMENT = "apartment"
    HOUSE = "house"
    STUDIO = "studio"
    COMMERCIAL = "commercial"
    LAND = "land"


class Transaction(StrEnum):
    SALE = "sale"
    RENT = "rent"


class PropertyStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD = "sold"
    RENTED = "rented"


class PropertySource(StrEnum):
    CASVITTA = "casvitta"  # created in Casvitta (Imóveis)
    MANUAL = "manual"  # typed in on the bio page by hand
    IMPORT = "import"  # synced from an external feed (CRM/XML), later


class SyncStatus(StrEnum):
    OK = "ok"
    FAILED = "failed"


class Property(UUIDPrimaryKey, Timestamps, WorkspaceScoped, DemoFlag, Base):
    __tablename__ = "properties"
    __table_args__ = (
        UniqueConstraint("workspace_id", "slug", name="uq_properties_workspace_slug"),
        CheckConstraint("price_cents >= 0", name="price_non_negative"),
    )

    code_number: Mapped[int] = mapped_column(
        Integer, property_code_seq, server_default=property_code_seq.next_value(), unique=True
    )
    slug: Mapped[str] = mapped_column(String(120))
    # Broker responsible for the listing: their CRECI is shown and must be verified (rule 1).
    responsible_broker_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("broker_profiles.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[PropertyKind] = mapped_column(str_enum(PropertyKind))
    transaction: Mapped[Transaction] = mapped_column(str_enum(Transaction))
    status: Mapped[PropertyStatus] = mapped_column(
        str_enum(PropertyStatus), default=PropertyStatus.DRAFT, server_default="draft"
    )
    source: Mapped[PropertySource] = mapped_column(
        str_enum(PropertySource), default=PropertySource.CASVITTA, server_default="casvitta"
    )
    title: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)

    # Location. Public: neighborhood, city, state (and street name when the broker allows it).
    street: Mapped[str | None] = mapped_column(String(160))
    show_street: Mapped[bool] = mapped_column(default=False, server_default="false")
    street_number: Mapped[str | None] = mapped_column(String(16))  # private
    complement: Mapped[str | None] = mapped_column(String(80))  # private
    postal_code: Mapped[str | None] = mapped_column(String(9))  # private
    neighborhood: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(2))
    lat: Mapped[float | None] = mapped_column(Float)  # private: public map is the neighborhood
    lng: Mapped[float | None] = mapped_column(Float)

    area_m2: Mapped[int | None] = mapped_column(Integer)
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[int | None] = mapped_column(Integer)
    suites: Mapped[int | None] = mapped_column(Integer)
    floor: Mapped[int | None] = mapped_column(Integer)
    parking: Mapped[int | None] = mapped_column(Integer)
    features: Mapped[list[str]] = mapped_column(
        ARRAY(String(80)), default=list, server_default="{}"
    )

    # Money in integer cents. Sale: price; rent: monthly rent. NULL costs = "Não informado".
    price_cents: Mapped[int] = mapped_column(Integer)
    condo_fee_cents: Mapped[int | None] = mapped_column(Integer)
    iptu_monthly_cents: Mapped[int | None] = mapped_column(Integer)

    # External source sync (bio pages keep the last confirmed data when a sync fails).
    sync_status: Mapped[SyncStatus | None] = mapped_column(str_enum(SyncStatus))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_error: Mapped[str | None] = mapped_column(String(300))

    @property
    def code(self) -> str:
        return f"CV-{self.code_number}"


class MediaKind(StrEnum):
    PHOTO = "photo"
    FLOORPLAN = "floorplan"
    VIDEO = "video"


class PropertyMedia(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "property_media"

    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[MediaKind] = mapped_column(str_enum(MediaKind), default=MediaKind.PHOTO)
    storage_key: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_cover: Mapped[bool] = mapped_column(default=False, server_default="false")
    # Share of the image covered by text (moderation BO6); NULL until analysed.
    text_ratio: Mapped[float | None] = mapped_column(Float)


class AuthorizationEvidence(StrEnum):
    DOCUMENT = "document"  # signed authorization uploaded
    ATTESTATION = "attestation"  # broker declares, in the app, that they hold it (signed in-app)


class AuthorizationReview(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class OwnerAuthorization(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    """Owner's sale/rental authorization (CLAUDE.md rule 2). No valid one, no publication."""

    __tablename__ = "owner_authorizations"

    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[Transaction] = mapped_column(str_enum(Transaction))
    exclusive: Mapped[bool] = mapped_column(default=False)
    evidence: Mapped[AuthorizationEvidence] = mapped_column(str_enum(AuthorizationEvidence))
    owner_name: Mapped[str] = mapped_column(String(160))
    document_key: Mapped[str | None] = mapped_column(String(300))
    attested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    signed_at: Mapped[date] = mapped_column(Date)
    # Valid through this day (inclusive), São Paulo time.
    expires_at: Mapped[date] = mapped_column(Date)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Staff check before the listing goes public (CRM mockup 04, BO6): "conferida".
    review_status: Mapped[AuthorizationReview] = mapped_column(
        str_enum(AuthorizationReview),
        default=lambda: AuthorizationReview.PENDING,
        server_default="pending",
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    review_reason: Mapped[str | None] = mapped_column(String(500))
