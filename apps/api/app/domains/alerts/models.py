"""Property alerts from public price pages ("avise-me", "quanto vale o meu apartamento?").

Platform-level on purpose, like interest_signups: these people are not any workspace's lead yet
(CLAUDE.md §5 keeps ``people`` per workspace). No message is sent in this milestone; staff see the
list in the admin. Consent per purpose with timestamp and source (rule 8).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.models import Timestamps, UUIDPrimaryKey, str_enum
from app.domains.interest.models import ConsentPurpose


class AlertScope(StrEnum):
    NEIGHBORHOOD = "neighborhood"
    STREET = "street"
    BUILDING = "building"


class AlertIntent(StrEnum):
    BUY = "buy"  # "avise-me quando houver imóvel à venda aqui"
    OWNER = "owner"  # "tenho um imóvel aqui" (valuation, future listing)


class AlertStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"


class PropertyAlert(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "property_alerts"

    city_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("market_cities.id", ondelete="CASCADE"), index=True
    )
    scope: Mapped[AlertScope] = mapped_column(str_enum(AlertScope, length=16))
    scope_id: Mapped[uuid.UUID] = mapped_column(index=True)
    intent: Mapped[AlertIntent] = mapped_column(str_enum(AlertIntent, length=16))
    name: Mapped[str] = mapped_column(String(120))
    phone_e164: Mapped[str] = mapped_column(String(16), index=True)
    email: Mapped[str | None] = mapped_column(String(254))
    source_page: Mapped[str | None] = mapped_column(String(300))
    utm_source: Mapped[str | None] = mapped_column(String(80))
    utm_medium: Mapped[str | None] = mapped_column(String(80))
    utm_campaign: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[AlertStatus] = mapped_column(
        str_enum(AlertStatus, length=16), default=AlertStatus.ACTIVE
    )

    consents: Mapped[list[PropertyAlertConsent]] = relationship(
        back_populates="alert", cascade="all, delete-orphan", lazy="selectin"
    )


class PropertyAlertConsent(UUIDPrimaryKey, Base):
    __tablename__ = "property_alert_consents"

    alert_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("property_alerts.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[ConsentPurpose] = mapped_column(str_enum(ConsentPurpose))
    granted: Mapped[bool] = mapped_column()
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(300))

    alert: Mapped[PropertyAlert] = relationship(back_populates="consents")
