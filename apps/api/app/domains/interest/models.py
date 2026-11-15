"""Interest signups from public capture pages (CLAUDE.md rule 11).

Platform-level on purpose: these people are not any workspace's lead yet, so the tables are not
WorkspaceScoped. Owner listing requests get a broker assigned by staff (rule 13).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.models import Timestamps, UUIDPrimaryKey, str_enum


class InterestKind(StrEnum):
    AGENCY = "agency"
    OWNER_LISTING = "owner_listing"
    DEVELOPER = "developer"
    INVESTOR_INSTITUTIONAL = "investor_institutional"
    RENTAL_ADMIN = "rental_admin"
    AUCTION = "auction"


class InterestStatus(StrEnum):
    PENDING_OPT_IN = "pending_opt_in"
    CONFIRMED = "confirmed"
    UNSUBSCRIBED = "unsubscribed"


class ConsentPurpose(StrEnum):
    CONTACT_ABOUT_PROPERTIES = "contact_about_properties"
    MARKETING = "marketing"


class InterestSignup(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "interest_signups"

    kind: Mapped[InterestKind] = mapped_column(str_enum(InterestKind), index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone_e164: Mapped[str] = mapped_column(String(16), index=True)
    email: Mapped[str | None] = mapped_column(String(254))
    criteria: Mapped[dict[str, Any]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    utm_source: Mapped[str | None] = mapped_column(String(80))
    utm_medium: Mapped[str | None] = mapped_column(String(80))
    utm_campaign: Mapped[str | None] = mapped_column(String(120))
    source_page: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[InterestStatus] = mapped_column(
        str_enum(InterestStatus), default=InterestStatus.PENDING_OPT_IN
    )
    opt_in_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opt_in_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Owner requests: staff assign a CRECI-registered broker (manual at first).
    assigned_broker_id: Mapped[uuid.UUID | None] = mapped_column()

    consents: Mapped[list[InterestSignupConsent]] = relationship(
        back_populates="signup", cascade="all, delete-orphan", lazy="selectin"
    )


class InterestSignupConsent(UUIDPrimaryKey, Base):
    __tablename__ = "interest_signup_consents"

    signup_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interest_signups.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[ConsentPurpose] = mapped_column(str_enum(ConsentPurpose))
    granted: Mapped[bool]
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(200))

    signup: Mapped[InterestSignup] = relationship(back_populates="consents")
