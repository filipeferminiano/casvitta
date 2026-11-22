"""Key events: the broker activity that counts for activation and maturity (PROMPT_CRM_BUILD §7).

Counted as activity: replying to a contact, moving a contact in the pipeline, creating, editing or
publishing a property, activating or editing an automation or agent. Not activity: logging in,
opening a page, or anything the agent did alone (`is_activity` false).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import UUIDPrimaryKey, WorkspaceScoped, str_enum


class KeyEventKind(StrEnum):
    CONTACT_CREATED = "contact_created"
    CONTACT_REPLIED = "contact_replied"
    PIPELINE_MOVED = "pipeline_moved"
    PROPERTY_CREATED = "property_created"
    PROPERTY_EDITED = "property_edited"
    PROPERTY_PUBLISHED = "property_published"
    VISIT_BOOKED = "visit_booked"
    AUTOMATION_CHANGED = "automation_changed"
    AGENT_CHANGED = "agent_changed"
    CONSENT_CHANGED = "consent_changed"


class EventActor(StrEnum):
    BROKER = "broker"
    CONTACT = "contact"
    AGENT = "agent"
    AUTOMATION = "automation"
    SYSTEM = "system"


ACTIVITY_KINDS = frozenset(
    {
        KeyEventKind.CONTACT_REPLIED,
        KeyEventKind.PIPELINE_MOVED,
        KeyEventKind.PROPERTY_CREATED,
        KeyEventKind.PROPERTY_EDITED,
        KeyEventKind.PROPERTY_PUBLISHED,
        KeyEventKind.AUTOMATION_CHANGED,
        KeyEventKind.AGENT_CHANGED,
    }
)


class KeyEvent(UUIDPrimaryKey, WorkspaceScoped, Base):
    __tablename__ = "key_events"
    __table_args__ = (Index("ix_key_events_workspace_occurred", "workspace_id", "occurred_at"),)

    kind: Mapped[KeyEventKind] = mapped_column(str_enum(KeyEventKind))
    actor: Mapped[EventActor] = mapped_column(str_enum(EventActor))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    person_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    # True only for broker actions of an activity kind (an agent acting alone never counts).
    is_activity: Mapped[bool] = mapped_column(default=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def is_activity(kind: KeyEventKind, actor: EventActor) -> bool:
    return actor == EventActor.BROKER and kind in ACTIVITY_KINDS
