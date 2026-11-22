"""Agenda de visitas: the broker's visit rules, busy blocks and visits.

Booking re-reads availability inside the transaction under a per-broker advisory lock, so two
bookings for the same slot can't both succeed ("horário já ocupado" is real).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum

# Mon..Sun → list of [start "HH:MM", end "HH:MM"] windows when visits can happen.
DEFAULT_WEEKLY_HOURS: dict[str, list[list[str]]] = {
    "mon": [["09:00", "12:00"], ["14:00", "18:00"]],
    "tue": [["09:00", "12:00"], ["14:00", "18:00"]],
    "wed": [["09:00", "12:00"], ["14:00", "18:00"]],
    "thu": [["09:00", "12:00"], ["14:00", "18:00"]],
    "fri": [["09:00", "12:00"], ["14:00", "18:00"]],
    "sat": [["09:00", "13:00"]],
    "sun": [],
}


class CalendarSettings(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "calendar_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_calendar_settings_user"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    visit_minutes: Mapped[int] = mapped_column(Integer, default=45)
    buffer_minutes: Mapped[int] = mapped_column(Integer, default=30)
    # Extra buffer when consecutive visits are in different neighborhoods.
    other_neighborhood_buffer_minutes: Mapped[int] = mapped_column(Integer, default=30)
    lead_time_minutes: Mapped[int] = mapped_column(Integer, default=180)
    days_ahead: Mapped[int] = mapped_column(Integer, default=14)
    weekly_hours: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    # e.g. {"sat": ["Cambuí", "Taquaral"]}: on that day only these neighborhoods.
    neighborhoods_by_day: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class BlockSource(StrEnum):
    MANUAL = "manual"  # "Bloquear horário"
    GOOGLE = "google"  # free/busy only, never the event content


class CalendarBlock(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "calendar_blocks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[BlockSource] = mapped_column(str_enum(BlockSource))


class AppointmentStatus(StrEnum):
    PROPOSED = "proposed"
    CONFIRMED = "confirmed"
    DONE = "done"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


ACTIVE_APPOINTMENT = frozenset({AppointmentStatus.PROPOSED, AppointmentStatus.CONFIRMED})


class BookedBy(StrEnum):
    BROKER = "broker"
    CONTACT = "contact"
    AGENT = "agent"


class Appointment(UUIDPrimaryKey, Timestamps, WorkspaceScoped, DemoFlag, Base):
    __tablename__ = "appointments"

    broker_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"))
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("properties.id", ondelete="SET NULL")
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    neighborhood: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[AppointmentStatus] = mapped_column(str_enum(AppointmentStatus))
    booked_by: Mapped[BookedBy] = mapped_column(str_enum(BookedBy))
    # {"day_before": "2026-11-28T18:00:00-03:00", "sent": [...]} — reminders are CRM-2 automations.
    reminders: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    cancelled_reason: Mapped[str | None] = mapped_column(String(300))
