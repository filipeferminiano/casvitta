"""Casvitta staff (backoffice users). Platform-level: staff are not members of any workspace.

Staff sign in with the same email-link mechanism as customers, but with their own tables, token
audience and cookies, so a customer session can never act as staff (and the reverse).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import Timestamps, UUIDPrimaryKey, str_enum


class StaffRole(StrEnum):
    ADMIN = "admin"
    OPERATIONS = "operations"
    COMMERCIAL = "commercial"
    FINANCE = "finance"
    READ_ONLY = "read_only"


class StaffUser(UUIDPrimaryKey, Timestamps, Base):
    """The allowlist: only these emails can sign in to the backoffice, and only while active."""

    __tablename__ = "staff_users"

    email: Mapped[str] = mapped_column(String(320), unique=True)  # stored lowercased
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[StaffRole] = mapped_column(str_enum(StaffRole))
    active: Mapped[bool] = mapped_column(default=True)
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StaffTokenPurpose(StrEnum):
    SIGN_IN = "sign_in"  # email link
    REAUTH = "reauth"  # 6-digit code typed in the backoffice before a sensitive action


class StaffLoginToken(UUIDPrimaryKey, Base):
    """Single-use secret sent by email. Only its hash is stored."""

    __tablename__ = "staff_login_tokens"

    staff_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[StaffTokenPurpose] = mapped_column(str_enum(StaffTokenPurpose))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StaffSession(UUIDPrimaryKey, Base):
    """Refresh-token session with rotation, an idle timeout and an absolute lifetime."""

    __tablename__ = "staff_sessions"

    staff_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"), index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # When the login started (absolute limit) and when the person last proved it is them
    # (email link or re-auth code): sensitive actions need a recent one.
    family_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    authenticated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(300))
