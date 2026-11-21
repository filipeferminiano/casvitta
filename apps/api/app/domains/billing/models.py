"""Plan and add-on changes. Billing is not wired: a change is a request that staff assign
(audited) while settings.billing_enabled is false. The states already fit a payment provider:
pending → awaiting_payment → approved, or declined / cancelled.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import Timestamps, UUIDPrimaryKey, WorkspaceScoped, str_enum
from app.domains.accounts.models import Plan


class ChangeKind(StrEnum):
    PLAN = "plan"
    ADD_ON = "add_on"


class ChangeStatus(StrEnum):
    PENDING = "pending"  # waiting for staff (or, later, for checkout to start)
    AWAITING_PAYMENT = "awaiting_payment"  # reserved for the payment provider
    APPROVED = "approved"
    DECLINED = "declined"
    CANCELLED = "cancelled"


OPEN = frozenset({ChangeStatus.PENDING, ChangeStatus.AWAITING_PAYMENT})


class ChangeSource(StrEnum):
    SIGNUP = "signup"
    PLANS_PAGE = "plans_page"
    LIMIT_REACHED = "limit_reached"
    FEATURE_GATE = "feature_gate"
    SUPPORT = "support"


class PlanChangeRequest(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "plan_change_requests"

    kind: Mapped[ChangeKind] = mapped_column(str_enum(ChangeKind))
    current_plan: Mapped[Plan] = mapped_column(str_enum(Plan, name="current_plan"))
    requested_plan: Mapped[Plan | None] = mapped_column(str_enum(Plan, name="requested_plan"))
    add_on_key: Mapped[str | None] = mapped_column(String(60))
    billing_period: Mapped[str] = mapped_column(String(8), default="monthly")
    source: Mapped[ChangeSource] = mapped_column(str_enum(ChangeSource))
    status: Mapped[ChangeStatus] = mapped_column(
        str_enum(ChangeStatus), default=ChangeStatus.PENDING, server_default="pending"
    )
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    handled_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(500))
