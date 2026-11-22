"""Stripe adapter over its REST API (httpx; no SDK). Used when STRIPE_SECRET_KEY is set.

Cards only for now (Pix Automático is invite-only for Brazilian accounts). Checkout and the
billing portal are Stripe's own pages, in pt-BR. Never logs customer data.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.logging import get_logger
from app.integrations.base import IntegrationError
from app.integrations.payments.events import parse_signed, subscription_from
from app.integrations.payments.port import Checkout, PaymentEvent, SubscriptionSnapshot

log = get_logger(__name__)

API = "https://api.stripe.com/v1"
NAME = "de pagamentos"


def encode(params: dict[str, Any], prefix: str = "") -> list[tuple[str, str]]:
    """Stripe's form encoding: a[b][0][c]=x."""
    out: list[tuple[str, str]] = []
    for key, value in params.items():
        name = f"{prefix}[{key}]" if prefix else str(key)
        if value is None:
            continue
        if isinstance(value, dict):
            out += encode(value, name)
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    out += encode(item, f"{name}[{i}]")
                else:
                    out.append((f"{name}[{i}]", str(item)))
        elif isinstance(value, bool):
            out.append((name, "true" if value else "false"))
        else:
            out.append((name, str(value)))
    return out


class StripePayments:
    def __init__(
        self,
        secret_key: str,
        webhook_secret: str,
        *,
        api_version: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._key = secret_key
        self._webhook_secret = webhook_secret
        self._version = api_version
        self._client = client or httpx.AsyncClient(timeout=20)
        self._prices: dict[str, str] = {}

    async def call(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._key}"}
        if self._version:
            headers["Stripe-Version"] = self._version
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        data = encode(params or {})
        try:
            if method == "GET":
                response = await self._client.get(
                    f"{API}{path}", params=urlencode(data), headers=headers
                )
            else:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                response = await self._client.post(
                    f"{API}{path}", content=urlencode(data), headers=headers
                )
        except httpx.HTTPError as exc:
            raise IntegrationError(NAME, str(exc)) from exc
        if response.status_code >= 400:
            error = (response.json() or {}).get("error", {}) if response.content else {}
            log.error(
                "stripe_call_failed",
                status=response.status_code,
                path=path.split("/")[1] if "/" in path else path,
                code=error.get("code"),
                type=error.get("type"),
            )
            raise IntegrationError(NAME, f"status {response.status_code}")
        body: dict[str, Any] = response.json()
        return body

    async def _price_id(self, lookup_key: str) -> str:
        if lookup_key not in self._prices:
            found = await self.call(
                "GET", "/prices", {"lookup_keys": [lookup_key], "active": True, "limit": 1}
            )
            data = found.get("data") or []
            if not data:
                raise IntegrationError(NAME, f"price {lookup_key} missing: run make stripe:sync")
            self._prices[lookup_key] = str(data[0]["id"])
        return self._prices[lookup_key]

    async def create_customer(self, *, email: str, name: str, workspace_id: str) -> str:
        body = await self.call(
            "POST",
            "/customers",
            {"email": email, "name": name, "preferred_locales": ["pt-BR"],
             "metadata": {"workspace_id": workspace_id}},
            idempotency_key=f"customer-{workspace_id}",
        )  # fmt: skip
        return str(body["id"])

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
        body = await self.call(
            "POST",
            "/checkout/sessions",
            {
                "mode": "subscription",
                "customer": customer_id,
                "client_reference_id": reference,
                "line_items": [{"price": await self._price_id(lookup_key), "quantity": 1}],
                "payment_method_types": ["card"],
                "locale": "pt-BR",
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {"workspace_id": workspace_id},
                "subscription_data": {"metadata": {"workspace_id": workspace_id}},
            },
            idempotency_key=f"checkout-{reference}",
        )
        return Checkout(id=str(body["id"]), url=str(body["url"]))

    async def get_subscription(self, subscription_id: str) -> SubscriptionSnapshot:
        return subscription_from(await self.call("GET", f"/subscriptions/{subscription_id}"))

    async def change_price(self, subscription_id: str, lookup_key: str) -> SubscriptionSnapshot:
        current = await self.call("GET", f"/subscriptions/{subscription_id}")
        item_id = current["items"]["data"][0]["id"]
        body = await self.call(
            "POST",
            f"/subscriptions/{subscription_id}",
            {
                "items": [{"id": item_id, "price": await self._price_id(lookup_key)}],
                # Charge (or credit) the difference now; keep the old plan until it is paid.
                "proration_behavior": "always_invoice",
                "payment_behavior": "pending_if_incomplete",
            },
        )
        return subscription_from(body)

    async def set_cancel_at_period_end(
        self, subscription_id: str, *, cancel: bool
    ) -> SubscriptionSnapshot:
        body = await self.call(
            "POST", f"/subscriptions/{subscription_id}", {"cancel_at_period_end": cancel}
        )
        return subscription_from(body)

    async def portal_url(self, customer_id: str, return_url: str) -> str:
        body = await self.call(
            "POST",
            "/billing_portal/sessions",
            {"customer": customer_id, "return_url": return_url, "locale": "pt-BR"},
        )
        return str(body["url"])

    def parse_event(self, payload: bytes, signature: str) -> PaymentEvent:
        return parse_signed(payload, signature, self._webhook_secret)
