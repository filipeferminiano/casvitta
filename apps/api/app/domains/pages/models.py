"""Casvitta Social: the broker's public page ({slug}.casvitta.com.br) and its visit counters.

The page is generated from records that already exist (broker profile, properties published on the
`bio_page` channel); it is never free HTML. The slug is the broker profile's slug.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum


class PageTheme(StrEnum):
    """Theme presets (packages/config pageThemes). Planta is the Casvitta product palette."""

    CAMBUI = "cambui"
    PLANTA = "planta"
    TERRACOTA = "terracota"


class WorksAs(StrEnum):
    BROKER = "broker"
    AGENCY = "agency"


class PageStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"  # the broker turned it off
    SUSPENDED = "suspended"  # staff action, with a reason


class BrokerPage(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "broker_pages"

    broker_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("broker_profiles.id", ondelete="CASCADE"), unique=True
    )
    theme: Mapped[PageTheme] = mapped_column(
        str_enum(PageTheme), default=PageTheme.CAMBUI, server_default="cambui"
    )
    works_as: Mapped[WorksAs] = mapped_column(
        str_enum(WorksAs), default=WorksAs.BROKER, server_default="broker"
    )
    agency_name: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[PageStatus] = mapped_column(
        str_enum(PageStatus), default=PageStatus.DRAFT, server_default="draft"
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unpublished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspended_reason: Mapped[str | None] = mapped_column(String(500))
    # Onboarding (mockup social/10): last step reached; done or "fazer depois".
    onboarding_step: Mapped[int] = mapped_column(Integer, default=2, server_default="2")
    onboarding_done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    onboarding_dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PageEventKind(StrEnum):
    PAGE_VIEW = "page_view"
    PROPERTY_VIEW = "property_view"
    WHATSAPP_CLICK = "whatsapp_click"  # a click on the button, never "message sent"


class PageSource(StrEnum):
    LINK = "link"  # the bio link (default)
    QR = "qr"
    CAMPAIGN = "campaign"  # utm_* present
    DIRECT = "direct"


class PageEvent(UUIDPrimaryKey, WorkspaceScoped, Base):
    """One row per visitor, kind, property and day (repeat views the same day are not counted)."""

    __tablename__ = "page_events"
    __table_args__ = (
        UniqueConstraint(
            "page_id", "kind", "property_code", "visitor_key", "day", name="uq_page_events_daily"
        ),
    )

    page_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("broker_pages.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[PageEventKind] = mapped_column(str_enum(PageEventKind))
    source: Mapped[PageSource] = mapped_column(str_enum(PageSource))
    # "" for page-level events (so the unique constraint applies; NULLs never collide).
    property_code: Mapped[str] = mapped_column(String(16), default="", server_default="")
    # Salted hash of IP + user agent + day: counts visitors without storing who they are.
    visitor_key: Mapped[str] = mapped_column(String(64))
    day: Mapped[date] = mapped_column(Date)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
