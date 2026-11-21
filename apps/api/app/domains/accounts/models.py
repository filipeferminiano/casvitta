from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum


class WorkspaceKind(StrEnum):
    BROKER = "broker"
    AGENCY = "agency"


class Plan(StrEnum):
    # Current offer (prices in settings.offer_*).
    CORRETOR = "corretor"
    # Legacy plans: kept valid so workspaces created before the new catalog keep working.
    ESSENCIAL = "essencial"
    PROFISSIONAL = "profissional"


class Workspace(UUIDPrimaryKey, Timestamps, DemoFlag, Base):
    """A tenant: an independent broker or an agency."""

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[WorkspaceKind] = mapped_column(
        str_enum(WorkspaceKind), default=WorkspaceKind.BROKER
    )
    plan: Mapped[Plan] = mapped_column(
        str_enum(Plan), default=Plan.CORRETOR, server_default=Plan.CORRETOR.value
    )


class User(UUIDPrimaryKey, Timestamps, DemoFlag, Base):
    """A person who signs in. Platform-level: one user may belong to several workspaces."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True)  # stored lowercased
    name: Mapped[str] = mapped_column(String(160))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    BROKER = "broker"
    ASSISTANT = "assistant"


class Membership(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[Role] = mapped_column(str_enum(Role), default=Role.OWNER)


class CreciKind(StrEnum):
    INDIVIDUAL = "F"  # pessoa física
    COMPANY = "J"  # pessoa jurídica


class BrokerProfile(UUIDPrimaryKey, Timestamps, WorkspaceScoped, DemoFlag, Base):
    """Public broker identity. Publishing needs creci_verified_at (CLAUDE.md rule 1)."""

    __tablename__ = "broker_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    display_name: Mapped[str] = mapped_column(String(160))
    # Subdomain {slug}.casvitta.com.br: unique across the platform.
    slug: Mapped[str] = mapped_column(String(63), unique=True)
    creci_name: Mapped[str | None] = mapped_column(String(160))
    creci_number: Mapped[str | None] = mapped_column(String(16))  # "000.000-F"
    creci_state: Mapped[str | None] = mapped_column(String(2))
    creci_kind: Mapped[CreciKind | None] = mapped_column(str_enum(CreciKind, length=1))
    creci_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creci_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    whatsapp_e164: Mapped[str | None] = mapped_column(String(20))
    bio: Mapped[str | None] = mapped_column(String(600))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    regions: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list, server_default="{}")


class LoginTokenPurpose(StrEnum):
    SIGN_IN = "sign_in"
    SIGN_UP = "sign_up"
    HANDOFF = "handoff"  # moves a session from casvitta.com.br to app.casvitta.com.br


class LoginToken(UUIDPrimaryKey, Base):
    """Single-use secret sent by email (or handed between hosts). Only its hash is stored."""

    __tablename__ = "login_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    purpose: Mapped[LoginTokenPurpose] = mapped_column(str_enum(LoginTokenPurpose))
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Sign-up details kept until the email is confirmed (name, plan).
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB(), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSession(UUIDPrimaryKey, Base):
    """Refresh-token session. Each refresh rotates the token; reusing an old one revokes all."""

    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Every rotation of one login shares the family id.
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(300))


class AuditLog(UUIDPrimaryKey, Base):
    """Staff reads and writes of personal data (CLAUDE.md rule 8)."""

    __tablename__ = "audit_log"

    actor: Mapped[str] = mapped_column(String(120))  # "staff:admin-token" until staff accounts
    action: Mapped[str] = mapped_column(String(80))  # e.g. "broker_profile.creci_verified"
    entity: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB(), default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
