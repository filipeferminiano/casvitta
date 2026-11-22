"""Stripe webhook signatures and event parsing, shared by the real and the fake adapter (the
fake signs Stripe-shaped payloads, so tests exercise this code)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import UTC, datetime
from typing import Any

from app.integrations.payments.port import InvalidSignature, PaymentEvent, SubscriptionSnapshot

TOLERANCE_SECONDS = 300


def sign(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    """The Stripe-Signature header for a payload (used by the fake and in tests)."""
    t = timestamp if timestamp is not None else int(time.time())
    mac = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={t},v1={mac}"


def verify(payload: bytes, header: str, secret: str, now: float | None = None) -> None:
    parts: dict[str, list[str]] = {}
    for item in header.split(","):
        key, _, value = item.strip().partition("=")
        parts.setdefault(key, []).append(value)
    try:
        t = int(parts["t"][0])
    except (KeyError, ValueError) as exc:
        raise InvalidSignature from exc
    if abs((now if now is not None else time.time()) - t) > TOLERANCE_SECONDS:
        raise InvalidSignature
    expected = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, sig) for sig in parts.get("v1", [])):
        raise InvalidSignature


def _ts(value: object) -> datetime | None:
    return datetime.fromtimestamp(value, UTC) if isinstance(value, int) else None


def _id(value: object) -> str | None:
    """Stripe fields are ids or expanded objects."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and isinstance(value.get("id"), str):
        return str(value["id"])
    return None


def subscription_from(obj: dict[str, Any]) -> SubscriptionSnapshot:
    items = (obj.get("items") or {}).get("data") or []
    first: dict[str, Any] = items[0] if items else {}
    price = first.get("price") or {}
    # Newer API versions keep the period on the item; older ones on the subscription.
    period_end = _ts(first.get("current_period_end")) or _ts(obj.get("current_period_end"))
    metadata = obj.get("metadata") or {}
    return SubscriptionSnapshot(
        id=str(obj["id"]),
        customer_id=_id(obj.get("customer")) or "",
        status=str(obj.get("status") or ""),
        lookup_key=price.get("lookup_key"),
        current_period_end=period_end,
        cancel_at_period_end=bool(obj.get("cancel_at_period_end")),
        workspace_id=metadata.get("workspace_id"),
    )


def _invoice_subscription(obj: dict[str, Any]) -> str | None:
    direct = _id(obj.get("subscription"))
    if direct:
        return direct
    details = ((obj.get("parent") or {}).get("subscription_details")) or {}
    return _id(details.get("subscription"))


def parse(payload: bytes) -> PaymentEvent:
    try:
        event = json.loads(payload)
        obj: dict[str, Any] = event["data"]["object"]
        kind = str(event["type"])
        event_id = str(event["id"])
    except (ValueError, KeyError, TypeError) as exc:
        raise InvalidSignature from exc
    created = _ts(event.get("created")) or datetime.now(UTC)
    if kind.startswith("customer.subscription."):
        sub = subscription_from(obj)
        return PaymentEvent(
            id=event_id, type=kind, created=created, customer_id=sub.customer_id, subscription=sub
        )
    if kind.startswith("checkout.session."):
        return PaymentEvent(
            id=event_id,
            type=kind,
            created=created,
            customer_id=_id(obj.get("customer")),
            reference=obj.get("client_reference_id"),
            subscription_id=_id(obj.get("subscription")),
        )
    if kind.startswith("invoice."):
        amount = obj.get("amount_paid") if kind == "invoice.paid" else obj.get("amount_due")
        return PaymentEvent(
            id=event_id,
            type=kind,
            created=created,
            customer_id=_id(obj.get("customer")),
            subscription_id=_invoice_subscription(obj),
            invoice_id=_id(obj.get("id")),
            amount_cents=amount if isinstance(amount, int) else None,
            currency=obj.get("currency"),
        )
    return PaymentEvent(id=event_id, type=kind, created=created, customer_id=None)


def parse_signed(payload: bytes, header: str, secret: str) -> PaymentEvent:
    verify(payload, header, secret)
    return parse(payload)
