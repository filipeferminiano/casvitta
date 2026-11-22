# Stripe (plan subscriptions, cards only)

Casvitta charges its own plans through Stripe. Card data never reaches Casvitta: brokers pay on
Stripe Checkout and manage the card and invoices on the Stripe billing portal. Media (Meta,
Google) is never charged here (CLAUDE.md rule 14).

## How it works

- `POST /v1/me/plan/checkout`: without a subscription, creates a Checkout session (monthly
  price found by lookup key `casvitta_plan_<plan>_monthly`). With one, switches the price now
  with proration (`always_invoice` + `pending_if_incomplete`: the old plan stays until the
  difference is paid).
- `POST /v1/webhooks/stripe`: signed events, each processed once (`payment_provider_events`).
  Subscription events re-read the subscription from Stripe, so delivery order doesn't matter.
  The workspace plan always follows the subscription: `active`/`past_due` keep the plan;
  `unpaid`/`canceled`/`incomplete_expired` put the workspace back on Grátis (nothing deleted).
- `invoice.paid` writes a `ledger_entries` row (`plan_subscription`, `received`, cents).
  `invoice.payment_failed` emails the workspace owner.
- "Voltar para o Grátis" = cancel at period end (undo with `POST /v1/me/plan/resume`).
- Staff can still assign a plan in the backoffice; the next subscription event wins.

## Settings and secrets

| Variable | Secret Manager | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `stripe_test_secret_key` | Test key outside production. Empty = fake adapter. |
| `STRIPE_WEBHOOK_SECRET` | `stripe_test_webhook_secret` | `whsec_…` of the webhook endpoint below. |
| `BILLING_ENABLED` | — | `false` until the owner turns billing on. |

The publishable key is not used (Checkout is a redirect).

## One-time setup per Stripe account (dashboard)

1. Account name and statement descriptor: Casvitta (CNPJ), not another business.
2. `make stripe:sync` with the key in the environment (refuses live keys without `ARGS=--live`).
   Idempotent; when a catalog price changes it creates a new price that takes the lookup key.
3. Webhook endpoint `https://api.casvitta.com.br/v1/webhooks/stripe`, events:
   `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`. Store its signing secret as `stripe_test_webhook_secret`.
4. Billing portal: allow updating the payment method and seeing invoices; cancellation **at the
   end of the period**; plan switching **off** (plans change in Plano e uso); locale pt-BR.
5. Smart retries on (Billing → Revenue recovery); after the last retry mark the subscription
   **unpaid** or **canceled** (both return the workspace to Grátis).

## Local development

Without `STRIPE_SECRET_KEY` the fake adapter runs: "Assinar" opens
`/api/v1/dev/payments/checkout/{id}` (never in production), where "Pagar com cartão de teste"
delivers the same signed events. Its state is in memory: restarting the API forgets fake
subscriptions.

With a test key locally, webhooks need the Stripe CLI (`stripe listen --forward-to
localhost:8000/v1/webhooks/stripe`, then use the `whsec_` it prints).

## Not built yet

Add-ons and extra agency users as subscription items, invoices and revenue in the backoffice
(BO5/BO7), Destaques one-off payments, notas fiscais (NFS-e: Stripe doesn't issue them in Brazil).
