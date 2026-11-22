"""Conversations and messages (Caixa de entrada). The same lead in CRM, inbox and calendar."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum


class ConversationChannel(StrEnum):
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    PAGE = "page"  # forms on the broker page or the listing page


class AiMode(StrEnum):
    ACTIVE = "active"  # the assistant or an automation answers
    PAUSED = "paused"  # the broker took over
    HANDED_OFF = "handed_off"  # the assistant passed it to the broker, with a reason


class Conversation(UUIDPrimaryKey, Timestamps, WorkspaceScoped, DemoFlag, Base):
    __tablename__ = "conversations"

    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"))
    channel: Mapped[ConversationChannel] = mapped_column(str_enum(ConversationChannel))
    ai_mode: Mapped[AiMode] = mapped_column(
        str_enum(AiMode), default=AiMode.PAUSED, server_default="paused"
    )
    handoff_reason: Mapped[str | None] = mapped_column(String(300))
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    # Last time the contact wrote: free-form replies only within the channel's window after it.
    last_inbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unread_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Direction(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class Author(StrEnum):
    CONTACT = "contact"
    BROKER = "broker"
    AUTOMATION = "automation"
    AGENT = "agent"
    SYSTEM = "system"


class MessageStatus(StrEnum):
    RECEIVED = "received"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class Message(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("workspace_id", "idempotency_key", name="uq_messages_idempotency"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    direction: Mapped[Direction] = mapped_column(str_enum(Direction))
    author: Mapped[Author] = mapped_column(str_enum(Author))
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[MessageStatus] = mapped_column(str_enum(MessageStatus))
    external_id: Mapped[str | None] = mapped_column(String(120))
    idempotency_key: Mapped[str | None] = mapped_column(String(120))
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(String(300))
