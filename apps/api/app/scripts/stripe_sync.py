"""Creates the Stripe products and monthly prices of the paid plans and add-ons (catalog).

    make stripe:sync            # test mode (STRIPE_SECRET_KEY must be a test key)
    make stripe:sync ARGS=--live  # live mode, only with the owner's OK

Idempotent: a price that already has the catalog amount is kept. When the catalog amount
changes, a new price takes over the lookup key (existing subscriptions keep their old price
until changed). Prints what it did; never prints the key.
"""

from __future__ import annotations

import asyncio
import os
import sys

from app.core.catalog import ADD_ONS, CHECKOUT_PLANS, PLANS, addon_lookup_key, price_lookup_key
from app.integrations.payments.stripe import StripePayments

# Product names shown on Stripe's checkout and invoices (pt-BR).
NAMES = {
    "essential": "Casvitta Essencial",
    "automation": "Casvitta Automação",
    "pro": "Casvitta Pro",
    "agency": "Casvitta Imobiliária",
    "ai_conversations_500": "Casvitta · +500 conversas de IA por mês",
    "automation_contacts_1000": "Casvitta · +1.000 contatos em automação por mês",
    "agency_extra_user": "Casvitta · usuário adicional (Imobiliária)",
}


async def sync(live: bool) -> None:
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key:
        sys.exit("STRIPE_SECRET_KEY is not set")
    is_live = key.startswith(("sk_live_", "rk_live_"))
    if is_live and not live:
        sys.exit("Refusing a live key without --live")
    if live and not is_live:
        sys.exit("--live given with a test key")
    stripe = StripePayments(key, webhook_secret="")
    items = [(p.value, price_lookup_key(p), PLANS[p].monthly_cents) for p in CHECKOUT_PLANS]
    items += [(a.key, addon_lookup_key(a.key), a.price_cents) for a in ADD_ONS]
    for key, lookup, cents in items:
        found = await stripe.call(
            "GET", "/prices", {"lookup_keys": [lookup], "active": True, "limit": 1}
        )
        current = (found.get("data") or [None])[0]
        if current and current["unit_amount"] == cents and current["currency"] == "brl":
            print(f"{lookup}: ok ({cents} cents)")
            continue
        product = await stripe.call(
            "POST",
            "/products",
            {"name": NAMES[key], "metadata": {"catalog_key": key}},
            idempotency_key=f"product-{key}-{cents}",
        )
        await stripe.call(
            "POST",
            "/prices",
            {
                "product": product["id"],
                "currency": "brl",
                "unit_amount": cents,
                "recurring": {"interval": "month"},
                "lookup_key": lookup,
                "transfer_lookup_key": True,
                "tax_behavior": "inclusive",
                "metadata": {"catalog_key": key},
            },
            idempotency_key=f"price-{lookup}-{cents}",
        )
        print(f"{lookup}: created ({cents} cents)")


if __name__ == "__main__":
    asyncio.run(sync(live="--live" in sys.argv[1:]))
