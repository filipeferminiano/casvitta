"""Where a property is published: one row per (property, channel) (CLAUDE.md §5)."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum


class Channel(StrEnum):
    MARKETPLACE = "marketplace"  # casvitta.com.br portal
    BIO_PAGE = "bio_page"  # broker page {slug}.casvitta.com.br (Casvitta Social)
    LANDING = "landing"  # property landing page
    META = "meta"
    GOOGLE = "google"


class ListingStatus(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"  # all broker checks pass; waiting for the staff check
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    SUSPENDED = "suspended"  # staff action (moderation)


class UnpublishReason(StrEnum):
    BROKER = "broker"
    AUTHORIZATION_EXPIRED = "authorization_expired"
    PROPERTY_UNAVAILABLE = "property_unavailable"  # sold, rented, paused
    STAFF = "staff"


class Listing(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "listings"
    __table_args__ = (
        UniqueConstraint("property_id", "channel", name="uq_listings_property_channel"),
    )

    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[Channel] = mapped_column(str_enum(Channel))
    status: Mapped[ListingStatus] = mapped_column(
        str_enum(ListingStatus), default=ListingStatus.DRAFT, server_default="draft"
    )
    external_id: Mapped[str | None] = mapped_column(String(120))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unpublished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unpublish_reason: Mapped[UnpublishReason | None] = mapped_column(str_enum(UnpublishReason))
