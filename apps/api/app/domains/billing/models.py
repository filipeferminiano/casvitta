"""Plan and add-on changes, and payments.

While settings.billing_enabled is false a change is a request that staff assign (audited). With
billing on, a paid plan goes through Stripe Checkout: pending → awaiting_payment → approved once
the provider confirms (webhook), or cancelled. The plan itself always follows the subscription.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, UniqueConstraint, func, sql
from sqlalchemy.dialects.postgresql import JSONB
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
    # Stripe Checkout started for this request (awaiting_payment until the provider confirms).
    checkout_id: Mapped[str | None] = mapped_column(String(120))


# ---------------------------------------------------------------------- payments (Stripe)


class SubscriptionStatus(StrEnum):
    """Mirrors the provider. `active` and `past_due` (Stripe still retrying) keep the plan;
    `unpaid`, `canceled` and `incomplete_expired` put the workspace back on Grátis."""

    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    CANCELED = "canceled"
    PAUSED = "paused"
    TRIALING = "trialing"  # never offered (no trials); kept so a provider value always maps


class BillingCustomer(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    """The workspace at the payment provider. Card data stays at the provider."""

    __tablename__ = "billing_customers"
    __table_args__ = (UniqueConstraint("workspace_id"),)

    provider_customer_id: Mapped[str] = mapped_column(String(80), unique=True)


class Subscription(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    __tablename__ = "subscriptions"

    provider_subscription_id: Mapped[str] = mapped_column(String(80), unique=True)
    provider_customer_id: Mapped[str] = mapped_column(String(80))
    plan: Mapped[Plan | None] = mapped_column(str_enum(Plan))
    status: Mapped[SubscriptionStatus] = mapped_column(str_enum(SubscriptionStatus))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False, server_default=sql.false())
    last_payment_failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Add-ons on the subscription: {"ai_conversations_500": 2} (units, from the provider).
    add_ons: Mapped[dict[str, int]] = mapped_column(JSONB, default=dict, server_default="{}")
    # Stripe test mode: shown in the backoffice as a test, never counted as revenue.
    is_test: Mapped[bool] = mapped_column(default=False, server_default=sql.false())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProviderEvent(UUIDPrimaryKey, Base):
    """Every webhook event processed once (platform-level: may not belong to a workspace)."""

    __tablename__ = "payment_provider_events"

    provider_event_id: Mapped[str] = mapped_column(String(80), unique=True)
    type: Mapped[str] = mapped_column(String(80))
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    outcome: Mapped[str] = mapped_column(String(40))
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class LedgerKind(StrEnum):
    PLAN_SUBSCRIPTION = "plan_subscription"
    ADD_ON = "add_on"
    HIGHLIGHT = "highlight"
    OWNER_LISTING = "owner_listing"
    COMMISSION = "commission"


class LedgerStatus(StrEnum):
    CONTRACTED = "contracted"
    FORECAST = "forecast"
    REALIZED = "realized"
    RECEIVED = "received"
    PAID_OUT = "paid_out"


class LedgerEntry(UUIDPrimaryKey, Timestamps, WorkspaceScoped, Base):
    """Casvitta's own revenue (CLAUDE.md rule 6). Media spend never enters here."""

    __tablename__ = "ledger_entries"
    __table_args__ = (UniqueConstraint("source_ref", "status"),)

    kind: Mapped[LedgerKind] = mapped_column(str_enum(LedgerKind))
    status: Mapped[LedgerStatus] = mapped_column(str_enum(LedgerStatus))
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="BRL", server_default="BRL")
    plan: Mapped[Plan | None] = mapped_column(str_enum(Plan))
    # The provider document (Stripe invoice id): one entry per document and status.
    source_ref: Mapped[str | None] = mapped_column(String(80))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_test: Mapped[bool] = mapped_column(default=False, server_default=sql.false())
