"""Paid plans through Stripe (cards only), when settings.billing_enabled is on.

- A broker without a subscription picks a paid plan → Stripe Checkout (Stripe's page; card data
  never reaches Casvitta). The plan changes only when Stripe confirms (webhook).
- With a subscription, a plan change happens at once with the difference charged or credited
  (prorated); until that charge is paid the old plan stays.
- Back to Grátis = cancel at the end of the paid period (CLAUDE.md: access ends at the end of
  the paid period; downgrades never delete records). It can be undone until then.
- Failed renewal: Stripe retries; the plan stays while `past_due` and the owner is emailed.
  When Stripe gives up (`unpaid`/`canceled`) the workspace goes back to Grátis.

The workspace plan always follows the subscription. Webhooks are processed once (by event id)
and re-read the subscription from Stripe, so out-of-order deliveries do not matter.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import CHECKOUT_PLANS, plan_from_lookup_key, price_lookup_key
from app.core.errors import AppError
from app.core.i18n import translate
from app.core.logging import get_logger
from app.core.settings import Settings
from app.core.tenancy import cross_tenant, current_workspace
from app.core.time import utcnow
from app.domains.accounts.models import Membership, Plan, Role, User, Workspace
from app.domains.billing.models import (
    OPEN,
    BillingCustomer,
    ChangeKind,
    ChangeSource,
    ChangeStatus,
    LedgerEntry,
    LedgerKind,
    LedgerStatus,
    PlanChangeRequest,
    ProviderEvent,
    Subscription,
    SubscriptionStatus,
)
from app.domains.billing.schemas import SubscriptionOut
from app.integrations.messaging.port import Email, EmailPort
from app.integrations.payments.port import PaymentEvent, PaymentsPort, SubscriptionSnapshot

log = get_logger(__name__)

# Statuses that keep the paid plan (past_due: Stripe is still retrying the card).
KEEPS_PLAN = frozenset(
    {SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIALING}
)
ENDED = frozenset(
    {
        SubscriptionStatus.CANCELED,
        SubscriptionStatus.UNPAID,
        SubscriptionStatus.INCOMPLETE_EXPIRED,
    }
)


class CheckoutIn(BaseModel):
    plan: Plan
    source: ChangeSource = ChangeSource.PLANS_PAGE


class CheckoutOut(BaseModel):
    # checkout: go to `url` (Stripe). changed: the plan changed now. pending: the difference is
    # being charged; the plan changes when it is paid.
    result: str
    url: str | None = None
    plan: Plan


class PortalOut(BaseModel):
    url: str


def _status(value: str) -> SubscriptionStatus:
    try:
        return SubscriptionStatus(value)
    except ValueError:
        return SubscriptionStatus.INCOMPLETE


def plan_url(settings: Settings, outcome: str | None = None) -> str:
    base = f"{settings.app_url}/plano"
    return f"{base}?pagamento={outcome}" if outcome else base


async def _workspace(session: AsyncSession) -> Workspace:
    workspace = await session.get(Workspace, current_workspace(session))
    if workspace is None:
        raise AppError("unauthorized", status_code=401)
    return workspace


async def live_subscription(session: AsyncSession) -> Subscription | None:
    """The workspace's subscription that still holds a plan (tenant session)."""
    return await session.scalar(
        select(Subscription)
        .where(Subscription.status.in_(KEEPS_PLAN))
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )


def subscription_out(sub: Subscription | None) -> SubscriptionOut | None:
    if sub is None:
        return None
    return SubscriptionOut(
        plan=sub.plan,
        status=sub.status,
        current_period_end=sub.current_period_end,
        cancel_at_period_end=sub.cancel_at_period_end,
        payment_failed=sub.status == SubscriptionStatus.PAST_DUE
        or sub.last_payment_failed_at is not None,
    )


async def billing_on(session: AsyncSession, settings: Settings, user_id: uuid.UUID) -> bool:
    """Stripe for this user: billing on and, while being tried, the user is on the allowlist."""
    if not settings.billing_enabled:
        return False
    if not settings.billing_allowed_emails:
        return True
    user = await session.get(User, user_id)
    return user is not None and user.email.lower() in settings.billing_allowed_emails


async def _require_billing(session: AsyncSession, settings: Settings, user_id: uuid.UUID) -> None:
    if not await billing_on(session, settings, user_id):
        raise AppError("billing_disabled", status_code=409)


async def _customer(
    session: AsyncSession, port: PaymentsPort, workspace: Workspace, user: User
) -> str:
    existing = await session.scalar(select(BillingCustomer))
    if existing is not None:
        return str(existing.provider_customer_id)
    customer_id = await port.create_customer(
        email=user.email, name=workspace.name, workspace_id=str(workspace.id)
    )
    session.add(BillingCustomer(provider_customer_id=customer_id))
    await session.flush()
    return customer_id


async def start_checkout(
    session: AsyncSession,
    port: PaymentsPort,
    settings: Settings,
    user_id: uuid.UUID,
    data: CheckoutIn,
) -> CheckoutOut:
    await _require_billing(session, settings, user_id)
    if data.plan not in CHECKOUT_PLANS:
        raise AppError("plan_not_sellable", status_code=422)
    workspace = await _workspace(session)
    sub = await live_subscription(session)
    if workspace.plan == data.plan and (sub is None or not sub.cancel_at_period_end):
        raise AppError("plan_already_active", status_code=409)
    user = await session.get(User, user_id)
    if user is None:
        raise AppError("unauthorized", status_code=401)
    if sub is not None and sub.status == SubscriptionStatus.PAST_DUE:
        raise AppError("payment_problem", status_code=409)

    for old in await session.scalars(
        select(PlanChangeRequest).where(
            PlanChangeRequest.status.in_(OPEN), PlanChangeRequest.kind == ChangeKind.PLAN
        )
    ):
        old.status = ChangeStatus.CANCELLED
    request = PlanChangeRequest(
        kind=ChangeKind.PLAN,
        current_plan=workspace.plan,
        requested_plan=data.plan,
        source=data.source,
        status=ChangeStatus.AWAITING_PAYMENT,
        requested_by_user_id=user.id,
    )
    session.add(request)
    await session.flush()

    if sub is not None:
        if sub.cancel_at_period_end:
            await port.set_cancel_at_period_end(sub.provider_subscription_id, cancel=False)
        snapshot = await port.change_price(
            sub.provider_subscription_id, price_lookup_key(data.plan)
        )
        await apply_snapshot(session, snapshot, workspace.id)
        changed = workspace.plan == data.plan
        return CheckoutOut(result="changed" if changed else "pending", plan=data.plan)

    customer_id = await _customer(session, port, workspace, user)
    checkout = await port.create_checkout(
        customer_id=customer_id,
        lookup_key=price_lookup_key(data.plan),
        reference=str(request.id),
        workspace_id=str(workspace.id),
        success_url=plan_url(settings, "ok"),
        cancel_url=plan_url(settings, "cancelado"),
    )
    request.checkout_id = checkout.id
    await session.flush()
    return CheckoutOut(result="checkout", url=checkout.url, plan=data.plan)


async def cancel_at_period_end(session: AsyncSession, port: PaymentsPort) -> bool:
    """Back to Grátis. With a subscription: at the end of the paid period (returns True);
    without one the caller switches now."""
    sub = await live_subscription(session)
    if sub is None:
        return False
    snapshot = await port.set_cancel_at_period_end(sub.provider_subscription_id, cancel=True)
    await apply_snapshot(session, snapshot, sub.workspace_id)
    return True


async def resume(session: AsyncSession, port: PaymentsPort) -> None:
    sub = await live_subscription(session)
    if sub is None or not sub.cancel_at_period_end:
        raise AppError("subscription_not_found", status_code=404)
    snapshot = await port.set_cancel_at_period_end(sub.provider_subscription_id, cancel=False)
    await apply_snapshot(session, snapshot, sub.workspace_id)


async def portal(
    session: AsyncSession, port: PaymentsPort, settings: Settings, user_id: uuid.UUID
) -> PortalOut:
    await _require_billing(session, settings, user_id)
    customer = await session.scalar(select(BillingCustomer))
    if customer is None:
        raise AppError("billing_customer_not_found", status_code=404)
    return PortalOut(url=await port.portal_url(customer.provider_customer_id, plan_url(settings)))


# ---------------------------------------------------------------------- provider state


async def _workspace_for(session: AsyncSession, snapshot: SubscriptionSnapshot) -> uuid.UUID | None:
    """Metadata first, then the customer we created (cross-tenant session)."""
    if snapshot.workspace_id:
        try:
            return uuid.UUID(snapshot.workspace_id)
        except ValueError:
            pass
    return await session.scalar(
        select(BillingCustomer.workspace_id).where(
            BillingCustomer.provider_customer_id == snapshot.customer_id
        )
    )


async def apply_snapshot(
    session: AsyncSession, snapshot: SubscriptionSnapshot, workspace_id: uuid.UUID | None = None
) -> uuid.UUID | None:
    """Store what the provider says and make the workspace plan follow it."""
    with cross_tenant(session):
        sub = await session.scalar(
            select(Subscription).where(Subscription.provider_subscription_id == snapshot.id)
        )
        owner = sub.workspace_id if sub else workspace_id or await _workspace_for(session, snapshot)
        if owner is None:
            log.warning("subscription_without_workspace", subscription=snapshot.id)
            return None
        workspace = await session.get(Workspace, owner)
        if workspace is None:
            return None
        status = _status(snapshot.status)
        if sub is None:
            sub = Subscription(
                workspace_id=owner,
                provider_subscription_id=snapshot.id,
                provider_customer_id=snapshot.customer_id,
                status=status,
            )
            session.add(sub)
        plan = plan_from_lookup_key(snapshot.lookup_key)
        sub.plan = plan or sub.plan
        sub.status = status
        sub.current_period_end = snapshot.current_period_end
        sub.cancel_at_period_end = snapshot.cancel_at_period_end
        if status in KEEPS_PLAN and sub.plan is not None:
            workspace.plan = sub.plan
        elif status in ENDED:
            sub.ended_at = sub.ended_at or utcnow()
            others = await session.scalar(
                select(Subscription.id).where(
                    Subscription.workspace_id == owner,
                    Subscription.id != sub.id,
                    Subscription.status.in_(KEEPS_PLAN),
                )
            )
            if others is None:
                workspace.plan = Plan.FREE  # records stay; only limits change
        for request in await session.scalars(
            select(PlanChangeRequest).where(
                PlanChangeRequest.workspace_id == owner,
                PlanChangeRequest.status == ChangeStatus.AWAITING_PAYMENT,
                PlanChangeRequest.requested_plan == workspace.plan,
            )
        ):
            request.status = ChangeStatus.APPROVED
            request.handled_at = utcnow()
        await session.flush()
    return owner


async def _owner_email(session: AsyncSession, workspace_id: uuid.UUID) -> tuple[str, str] | None:
    row = (
        await session.execute(
            select(User.email, User.name)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.workspace_id == workspace_id, Membership.role == Role.OWNER)
            .limit(1)
        )
    ).first()
    return (row[0], row[1]) if row else None


async def handle_event(
    session: AsyncSession,
    event: PaymentEvent,
    port: PaymentsPort,
    *,
    email_port: EmailPort,
    settings: Settings,
) -> str:
    """Processes a verified webhook event once. Returns the outcome (kept with the event)."""
    with cross_tenant(session):
        seen = await session.scalar(
            select(ProviderEvent.id).where(ProviderEvent.provider_event_id == event.id)
        )
    if seen is not None:
        return "duplicate"

    outcome = "ignored"
    workspace_id: uuid.UUID | None = None
    subscription_id = event.subscription.id if event.subscription else event.subscription_id

    if event.type.startswith("customer.subscription.") and subscription_id:
        # Re-read: deliveries can arrive out of order.
        workspace_id = await apply_snapshot(session, await port.get_subscription(subscription_id))
        outcome = "subscription_synced"
    elif event.type == "checkout.session.completed" and subscription_id:
        workspace_id = await apply_snapshot(session, await port.get_subscription(subscription_id))
        outcome = "checkout_completed"
    elif event.type == "checkout.session.expired" and event.reference:
        with cross_tenant(session):
            request = await session.get(PlanChangeRequest, _uuid(event.reference))
            if request is not None and request.status == ChangeStatus.AWAITING_PAYMENT:
                request.status = ChangeStatus.CANCELLED
                workspace_id = request.workspace_id
                await session.flush()
        outcome = "checkout_expired"
    elif event.type in ("invoice.paid", "invoice.payment_failed") and subscription_id:
        with cross_tenant(session):
            sub = await session.scalar(
                select(Subscription).where(Subscription.provider_subscription_id == subscription_id)
            )
        if sub is None:  # the subscription event may come later: sync it first
            await apply_snapshot(session, await port.get_subscription(subscription_id))
            with cross_tenant(session):
                sub = await session.scalar(
                    select(Subscription).where(
                        Subscription.provider_subscription_id == subscription_id
                    )
                )
        if sub is not None:
            workspace_id = sub.workspace_id
            if event.type == "invoice.paid":
                outcome = await _record_payment(session, sub, event)
            else:
                outcome = await _payment_failed(session, sub, email_port, settings)

    with cross_tenant(session):
        session.add(
            ProviderEvent(
                provider_event_id=event.id,
                type=event.type[:80],
                workspace_id=workspace_id,
                outcome=outcome,
            )
        )
        try:
            await session.flush()
        except IntegrityError:  # the same event processed concurrently
            await session.rollback()
            return "duplicate"
    return outcome


def _uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


async def _record_payment(session: AsyncSession, sub: Subscription, event: PaymentEvent) -> str:
    with cross_tenant(session):
        sub.last_payment_failed_at = None
        if event.amount_cents and event.invoice_id:
            exists = await session.scalar(
                select(LedgerEntry.id).where(
                    LedgerEntry.source_ref == event.invoice_id,
                    LedgerEntry.status == LedgerStatus.RECEIVED,
                )
            )
            if exists is None:
                session.add(
                    LedgerEntry(
                        workspace_id=sub.workspace_id,
                        kind=LedgerKind.PLAN_SUBSCRIPTION,
                        status=LedgerStatus.RECEIVED,
                        amount_cents=event.amount_cents,
                        currency=(event.currency or "brl").upper(),
                        plan=sub.plan,
                        source_ref=event.invoice_id,
                        occurred_at=event.created,
                    )
                )
        await session.flush()
    return "payment_recorded"


async def _payment_failed(
    session: AsyncSession, sub: Subscription, email_port: EmailPort, settings: Settings
) -> str:
    with cross_tenant(session):
        sub.last_payment_failed_at = utcnow()
        await session.flush()
        owner = await _owner_email(session, sub.workspace_id)
    if owner is not None:
        email, name = owner
        await email_port.send(
            Email(
                to=email,
                subject=translate("email.payment_failed.subject"),
                text=translate(
                    "email.payment_failed.text",
                    {"name": name.split(" ")[0], "link": plan_url(settings)},
                ),
            )
        )
    return "payment_failed"
