"""Payments for Casvitta's own subscriptions (plans; add-ons and Destaques later).

Real adapter: Stripe (decided 22/11/2026), cards only. Card data never reaches Casvitta: the
broker pays on Stripe Checkout and manages the card on the Stripe billing portal. Media is never
charged here (CLAUDE.md rule 14: Meta and Google bill the broker directly).

Prices are found by lookup key (app.core.catalog.price_lookup_key), created from the catalog by
`make stripe:sync`, so the catalog stays the single source of prices.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Checkout:
    id: str
    url: str


@dataclass(frozen=True, slots=True)
class SubscriptionSnapshot:
    """What the provider says about a subscription, normalized."""

    id: str
    customer_id: str
    # Provider status: active, past_due, unpaid, canceled, incomplete, incomplete_expired, ...
    status: str
    lookup_key: str | None  # of the plan price; None if it has no known price
    # Every item: (price lookup key, quantity), plan and add-ons.
    items: tuple[tuple[str, int], ...]
    current_period_end: datetime | None
    cancel_at_period_end: bool
    workspace_id: str | None  # from the subscription metadata
    livemode: bool = False  # False = Stripe test mode (never revenue)


@dataclass(frozen=True, slots=True)
class PaymentEvent:
    id: str
    type: str
    created: datetime
    customer_id: str | None = None
    subscription: SubscriptionSnapshot | None = None
    # checkout.session.*: the plan change request id and the subscription created
    reference: str | None = None
    subscription_id: str | None = None
    # invoice.*: amounts in cents (BRL)
    invoice_id: str | None = None
    amount_cents: int | None = None
    currency: str | None = None
    livemode: bool = False


class InvalidSignature(Exception):
    """The webhook payload was not signed with our secret (or is too old)."""


class PaymentsPort(Protocol):
    async def create_customer(self, *, email: str, name: str, workspace_id: str) -> str: ...

    async def create_checkout(
        self,
        *,
        customer_id: str,
        lookup_key: str,
        reference: str,
        workspace_id: str,
        success_url: str,
        cancel_url: str,
    ) -> Checkout: ...

    async def get_subscription(self, subscription_id: str) -> SubscriptionSnapshot: ...

    async def change_price(self, subscription_id: str, lookup_key: str) -> SubscriptionSnapshot:
        """Switch the plan now, charging or crediting the difference (prorated). The change only
        takes effect once paid: until then the snapshot keeps the old price."""
        ...

    async def set_item_quantity(
        self, subscription_id: str, lookup_key: str, quantity: int
    ) -> SubscriptionSnapshot:
        """Add-ons: add, change or (quantity 0) remove an item. More units are charged now
        (prorated) and only count once paid; fewer units are credited."""
        ...

    async def set_cancel_at_period_end(
        self, subscription_id: str, *, cancel: bool
    ) -> SubscriptionSnapshot: ...

    async def portal_url(self, customer_id: str, return_url: str) -> str: ...

    def parse_event(self, payload: bytes, signature: str) -> PaymentEvent:
        """Verifies the signature and normalizes the event; raises InvalidSignature."""
        ...
