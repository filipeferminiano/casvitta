"""In-memory stand-in for Stripe (dev and tests). Checkout "completes" when told to
(`complete_checkout`, or the dev page /v1/dev/payments/checkout/{id}), producing the same
signed, Stripe-shaped webhook payloads the real account would send."""

from __future__ import annotations

import itertools
import json
import time
from dataclasses import dataclass, field
from typing import Any

from app.integrations.payments.events import parse_signed, plan_item, sign, subscription_from
from app.integrations.payments.port import Checkout, PaymentEvent, SubscriptionSnapshot

FAKE_WEBHOOK_SECRET = "whsec_fake_casvitta"  # noqa: S105 - not a secret, the fake's own key
MONTH = 30 * 24 * 3600


@dataclass(slots=True)
class _Session:
    customer_id: str
    lookup_key: str
    reference: str
    workspace_id: str
    success_url: str
    cancel_url: str
    completed: bool = False


@dataclass
class FakePayments:
    """`prices` is the cents per lookup key (from the catalog in tests); `checkout_base` is where
    the dev checkout page lives."""

    checkout_base: str = "http://app.localhost:3000/api/v1/dev/payments/checkout"
    webhook_secret: str = FAKE_WEBHOOK_SECRET
    prices: dict[str, int] = field(default_factory=dict)
    customers: dict[str, dict[str, str]] = field(default_factory=dict)
    sessions: dict[str, _Session] = field(default_factory=dict)
    subscriptions: dict[str, dict[str, Any]] = field(default_factory=dict)
    # Set to make the next upgrade's payment fail (the change stays pending).
    decline_next_change: bool = False
    _seq: itertools.count[int] = field(default_factory=lambda: itertools.count(1))

    def _next(self, prefix: str) -> str:
        return f"{prefix}_fake{next(self._seq):04d}"

    # ------------------------------------------------------------------ port

    async def create_customer(self, *, email: str, name: str, workspace_id: str) -> str:
        cid = self._next("cus")
        self.customers[cid] = {"email": email, "name": name, "workspace_id": workspace_id}
        return cid

    async def create_checkout(
        self,
        *,
        customer_id: str,
        lookup_key: str,
        reference: str,
        workspace_id: str,
        success_url: str,
        cancel_url: str,
    ) -> Checkout:
        sid = self._next("cs")
        self.sessions[sid] = _Session(
            customer_id, lookup_key, reference, workspace_id, success_url, cancel_url
        )
        return Checkout(id=sid, url=f"{self.checkout_base}/{sid}")

    async def get_subscription(self, subscription_id: str) -> SubscriptionSnapshot:
        return subscription_from(self.subscriptions[subscription_id])

    async def change_price(self, subscription_id: str, lookup_key: str) -> SubscriptionSnapshot:
        sub = self.subscriptions[subscription_id]
        if self.decline_next_change:
            self.decline_next_change = False  # payment pending: keeps the old price
        else:
            plan_item(sub)["price"]["lookup_key"] = lookup_key
        return subscription_from(sub)

    async def set_item_quantity(
        self, subscription_id: str, lookup_key: str, quantity: int
    ) -> SubscriptionSnapshot:
        sub = self.subscriptions[subscription_id]
        items: list[dict[str, Any]] = sub["items"]["data"]
        current = next((i for i in items if i["price"]["lookup_key"] == lookup_key), None)
        if self.decline_next_change and (quantity > (current or {}).get("quantity", 0)):
            self.decline_next_change = False
            return subscription_from(sub)
        if current is None and quantity > 0:
            items.append(
                {"id": self._next("si"), "price": {"lookup_key": lookup_key}, "quantity": quantity}
            )
        elif current is not None and quantity == 0:
            items.remove(current)
        elif current is not None:
            current["quantity"] = quantity
        return subscription_from(sub)

    async def set_cancel_at_period_end(
        self, subscription_id: str, *, cancel: bool
    ) -> SubscriptionSnapshot:
        sub = self.subscriptions[subscription_id]
        sub["cancel_at_period_end"] = cancel
        return subscription_from(sub)

    async def portal_url(self, customer_id: str, return_url: str) -> str:
        return f"{return_url}?portal=simulado"

    def parse_event(self, payload: bytes, signature: str) -> PaymentEvent:
        return parse_signed(payload, signature, self.webhook_secret)

    # ------------------------------------------------------------------ simulation

    def event(self, kind: str, obj: dict[str, Any]) -> tuple[bytes, str]:
        """A signed webhook delivery: (body, Stripe-Signature header)."""
        body = json.dumps(
            {"id": self._next("evt"), "type": kind, "created": int(time.time()),
             "data": {"object": obj}}
        ).encode()  # fmt: skip
        return body, sign(body, self.webhook_secret)

    def complete_checkout(self, session_id: str) -> list[tuple[bytes, str]]:
        """The broker paid: the subscription exists and is active."""
        s = self.sessions[session_id]
        s.completed = True
        sub_id = self._next("sub")
        sub = {
            "id": sub_id,
            "customer": s.customer_id,
            "status": "active",
            "cancel_at_period_end": False,
            "metadata": {"workspace_id": s.workspace_id},
            "items": {"data": [{"id": self._next("si"), "price": {"lookup_key": s.lookup_key},
                                "quantity": 1, "current_period_end": int(time.time()) + MONTH}]},
        }  # fmt: skip
        self.subscriptions[sub_id] = sub
        invoice = {
            "id": self._next("in"),
            "customer": s.customer_id,
            "subscription": sub_id,
            "amount_paid": self.prices.get(s.lookup_key, 0),
            "currency": "brl",
        }
        return [
            self.event("customer.subscription.created", sub),
            self.event("invoice.paid", invoice),
            self.event(
                "checkout.session.completed",
                {
                    "id": session_id,
                    "customer": s.customer_id,
                    "client_reference_id": s.reference,
                    "subscription": sub_id,
                },
            ),
        ]

    def set_status(self, subscription_id: str, status: str) -> tuple[bytes, str]:
        """Stripe moved the subscription (past_due after a failed renewal, unpaid, canceled)."""
        sub = self.subscriptions[subscription_id]
        sub["status"] = status
        kind = (
            "customer.subscription.deleted"
            if status == "canceled"
            else ("customer.subscription.updated")
        )
        return self.event(kind, sub)

    def invoice_failed(self, subscription_id: str) -> tuple[bytes, str]:
        sub = self.subscriptions[subscription_id]
        lookup = plan_item(sub)["price"]["lookup_key"]
        return self.event(
            "invoice.payment_failed",
            {"id": self._next("in"), "customer": sub["customer"], "subscription": subscription_id,
             "amount_due": self.prices.get(lookup, 0), "currency": "brl"},
        )  # fmt: skip
