"""Pipeline (Funil): configurable stages per workspace and one lead per contact × property
(or per contact when there is no property yet). Defaults: Novo → Em conversa → Visita marcada →
Proposta → Fechado / Perdido.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum


class StageKind(StrEnum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"


# Default stages (key, position, kind). `key` lets automations target a stage by meaning.
DEFAULT_STAGES: tuple[tuple[str, StageKind], ...] = (
    ("new", StageKind.OPEN),
    ("in_conversation", StageKind.OPEN),
    ("visit_booked", StageKind.OPEN),
    ("proposal", StageKind.OPEN),
    ("won", StageKind.WON),
    ("lost", StageKind.LOST),
)


class PipelineStage(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "pipeline_stages"

    key: Mapped[str | None] = mapped_column(String(40))  # None for stages the broker added
    name: Mapped[str | None] = mapped_column(String(60))  # None = default pt-BR name by key
    position: Mapped[int] = mapped_column(Integer)
    kind: Mapped[StageKind] = mapped_column(str_enum(StageKind), default=StageKind.OPEN)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Lead(UUIDPrimaryKey, Timestamps, WorkspaceScoped, DemoFlag, Base):
    __tablename__ = "leads"

    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("properties.id", ondelete="SET NULL"), index=True
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_stages.id", ondelete="RESTRICT"), index=True
    )
    source: Mapped[str] = mapped_column(String(32))
    campaign_id: Mapped[uuid.UUID | None] = mapped_column()
    acquisition_cost_cents: Mapped[int | None] = mapped_column(Integer)
    # financing_pct, uses_fgts, fgts_cents, down_payment_cents, household_income_cents, timeframe
    qualification: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    responsible_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    stage_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lost_reason: Mapped[str | None] = mapped_column(String(300))
    # Automations tied to stages (e.g. visit reminder) can be switched off per lead.
    automations_paused: Mapped[bool] = mapped_column(default=False, server_default="false")


class Task(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    """Next step ("Próxima ação") on a contact."""

    __tablename__ = "tasks"

    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
