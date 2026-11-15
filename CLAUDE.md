# CLAUDE.md — Casvitta

This file is the standing context for every Claude Code session in this repository. Read it fully before doing anything. Then read `docs/DESIGN_SYSTEM.md` before writing any UI, and open the matching screens in `docs/mockups/` (PNG to see it, HTML for exact copy and structure) before building any screen.

## 1. What we are building

**Casvitta** (casvitta.com.br) is a real-estate platform for Brazil. One property record sits at the center; two "doors" bring customers in and feed the same data core:

- **Door 1 — Visibility & demand:** a property **Marketplace** plus **Ads Studio**. A broker selects a property, AI writes the ad from the property record, the broker approves and sets a daily budget, and the ad goes live on the marketplace, on a property landing page, and on Meta (Instagram/Facebook) and Google. Leads arrive on WhatsApp, an AI assistant qualifies them (financing, FGTS, down payment) and books a visit in the broker's free calendar slots. A weekly report shows cost per lead and per booked visit in BRL.
- **Door 2 — Operations:** **Broker OS**, a SaaS for independent brokers (and later **Agency OS** for agencies): dashboard, leads CRM (Kanban), lead detail with WhatsApp history, WhatsApp inbox with AI agent, visit calendar, proposals, broker landing page, property landing pages.

Every module reads and writes the same core. A lead created by an ad is the same lead in the CRM, the inbox, the calendar and the proposals screen. Never duplicate data between modules.

Later modules (do NOT build unless a task says so; show them as "Em breve" in the module store): Rental OS, Contracts, Billing/Collections, Insurance, Property Finance, Network OS (partner brokers), Developer OS, FII Suite, Risk & Pricing Engine, Command Center, Home Hub.

### Plans (reference prices, keep in config, not hard-coded)

| Plan | Price | Limits / features |
|---|---|---|
| Essencial | R$ 197/month | up to 3 active properties; broker landing page + one per property; CRM, inbox, calendar, proposals; WhatsApp AI assistant |
| Profissional | R$ 397/month | up to 15 active properties; everything in Essencial; Facebook & Instagram page management; weekly report by channel |

Media spend is paid by the customer, minimum R$ 20/day per property (config: `MIN_DAILY_BUDGET_CENTS=2000`); the customer chooses any amount at or above it. Charged only on what is spent, up to a cap the customer sets.

## 2. Language rules (strict)

- **Code, identifiers, comments, commit messages, docs, tests, API field names, DB names: English.**
- **Every user-facing string: Brazilian Portuguese (pt-BR)**, both consumer marketplace and broker app. Never hard-code UI copy in components; put it in the message catalog (`apps/web/messages/pt-BR.json`) and read it through the i18n helper. Only pt-BR exists for now, but keep the mechanism.
- Write copy from the user's side: short, active, specific. "Publicar anúncio", not "Submeter". Errors say what went wrong and how to fix it. No marketing jargon in the broker UI (say "pessoas que viram", "pedidos de visita"; never CPM, CTR, CPC on primary screens).
- Formatting: BRL as `R$ 690.000` / `R$ 6.563,40` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`), dates `dd/MM/yyyy`, times `HHhMM` everywhere including chat (`14h03`, `11h30`), and `14h` when minutes are zero. Timezone `America/Sao_Paulo`. Phones stored in E.164, displayed `(11) 92740-8912`.

## 3. Stack (decided — do not swap without asking)

**Monorepo** with pnpm workspaces + Turborepo for JS, uv for Python.

```
casvitta/
  apps/
    api/            # Python backend
    web/            # Next.js frontend (marketplace + broker app + landing pages)
  packages/
    ui/             # shared React components implementing the design system
    config/         # shared tsconfig, eslint, tailwind preset (tokens)
    api-client/     # TypeScript client generated from the API's OpenAPI schema
  docs/
  infra/            # docker-compose, deployment
```

### Backend — `apps/api`
- Python 3.12, **FastAPI**, Pydantic v2, **SQLAlchemy 2.0** (async, typed `Mapped[]` models), **Alembic** migrations.
- **PostgreSQL 16** (+ PostGIS later for maps). **Redis** for cache and the job queue.
- Background jobs: **arq** (async, Redis-based) — AI generation, WhatsApp sends, ad sync, weekly reports.
- Auth: email magic link + phone OTP; sessions via httpOnly secure cookies (JWT access + rotating refresh). Multi-tenant by `workspace_id` on every tenant table — including child tables (listings, campaigns, appointments, proposals, messages, …) and `people` (a person belongs to one workspace); enforce in a repository/service layer and test it.
- Tooling: `uv`, `ruff` (lint + format), `mypy --strict` on `app/`, `pytest` + `pytest-asyncio` + `httpx.AsyncClient`, factory-based fixtures, a real Postgres in tests (testcontainers or docker-compose service).
- Structure by domain, not by layer:
  ```
  app/
    core/        # settings, db, security, i18n of server messages, money, time
    domains/
      accounts/  properties/  listings/  leads/  conversations/
      appointments/  proposals/  ads/  landing_pages/  social/  reports/
    integrations/  # ports + adapters: llm, whatsapp, meta, google_ads, storage, email
    workers/
    api/v1/        # routers only; thin
  ```
- Every external integration is a **port (Protocol) with a fake adapter** used in dev and tests, plus the real adapter behind a feature flag. Never call a third-party API directly from a router or service.
- LLM: Anthropic Claude API through `integrations/llm`. Prompts live in versioned files (`app/integrations/llm/prompts/*.md`), outputs are validated with Pydantic schemas, and every AI call is logged (prompt version, model, tokens, latency, outcome) for review.

### Frontend — `apps/web`
- **Next.js (App Router) + TypeScript (strict) + React Server Components.** SSR/SSG matters for SEO on marketplace and landing pages.
- Route groups:
  - `(marketplace)` — public site at `casvitta.com.br`: home, search/results (list + map, with a "Para investir" mode), property detail, visit booking, financing simulator, and the audience pages: `/para-corretores` (+ agencies section), `/cadastro` (broker signup), `/anunciar-imovel` (owners), `/incorporadoras` (waitlist), `/investidores`, `/leilao` (capture only). See `docs/mockups/50-journey-map.png` for how each path lands in the product.
  - `(landing)` — broker pages `/{brokerSlug}` and property pages `/{brokerSlug}/{propertySlug}`, served on `{brokerSlug}.casvitta.com.br` via middleware rewrite.
  - `(app)` — authenticated Broker OS at `app.casvitta.com.br`: Início, Imóveis, Leads, Conversas, Agenda, Propostas, Anúncios, Loja de módulos, Configurações. "Ads Studio" is the internal/backoffice name only (code, backend, docs); every user-facing label says **Anúncios**.
- Styling: **Tailwind CSS 4** with a CSS-first theme (`@theme`) generated from the design tokens (`packages/config/tokens.ts` → `packages/config/tailwind-preset.css`). Primitives on **Radix UI**, composed in `packages/ui` (shadcn-style, but our own tokens and components — no default shadcn theme).
- Data: TanStack Query for client data, typed client from `packages/api-client` (generated with `openapi-typescript` + `openapi-fetch`). Forms: React Hook Form + Zod. i18n: `next-intl` with `pt-BR`.
- Tests: Vitest + Testing Library for components, Playwright for the two anchor flows (§6). Storybook for `packages/ui`.
- Accessibility is required: real `<button>`/`<a>`/`<label>`, visible focus, 4.5:1 text contrast, touch targets ≥ 44px, keyboard-operable Kanban (moves via menu as well as drag).

## 4. Product rules that the code must enforce

These come from Brazilian regulation and from the brand's trust promise. Treat them as invariants with tests.

1. **CRECI everywhere.** Every published listing, ad creative, landing page and broker card shows the responsible broker's CRECI. A broker cannot publish without a validated CRECI number on their profile. Validation is manual for now: format check on input, then staff set `creci_verified_at`; an automated lookup comes later.
2. **Sale/rental authorization gate.** A property cannot be published (marketplace, landing page or ads) without an owner authorization record (type: sale/rental, exclusivity yes/no, signed date, expiry). Expired authorization unpublishes the listing.
3. **AI is always identified.** Every AI-generated text in the UI carries the "Feito por IA" badge; the WhatsApp assistant introduces itself as the broker's virtual assistant in its first message.
4. **AI never negotiates price or conditions, never promises credit approval, never invents property facts.** Ad copy may only use facts from the property record; the generator returns the source field of each claim and the UI shows it. Price negotiation or anger → hand off to the human with a reason.
5. **Financing is always a simulation.** Any mortgage number is labeled "Simulação · não é aprovação". Implement SAC and Price tables in `core/finance.py` with tests. Default illustrative rate is configurable; display rate, term, down payment and that insurance/fees are excluded.
6. **Money is integer cents** (`amount_cents: int`, currency `BRL`). Never floats for money. Ad spend, plan prices and commissions go through one small ledger (`ledger_entries`) with `kind` and `status` (`contracted`, `forecast`, `realized`, `received`, `paid_out`).
7. **Demo data is flagged.** Seed/demo records have `is_demo=true`; UI shows the yellow "Demonstrativo" badge on them.
8. **LGPD.** Store consent per purpose (`contact_about_properties`, `marketing`) with timestamp and source; respect it in every outbound message. Audit log for reads/writes of personal data by staff. Data export and deletion endpoints per person.
9. **Future modules are not fake.** "Em breve" items have no working purchase/activation; their button only records interest (`module_interest` table) for the discovery log.
10. **Media spend has a hard cap.** A campaign never exceeds `daily_budget_cents × days` nor the explicit `max_spend_cents`; enforce on our side, not only on the ad platform.
11. **Capture pages promise nothing we don't have.** Waitlist/interest pages (developers, investors' institutional section, auctions, rental administration) only store an `interest_signups` record and send a WhatsApp double opt-in; they never show inventory, dates, discounts or features as available.
12. **Estimates are labeled.** Rental income and yield estimates show "Estimativa · não é garantia" and the comparables count; hide them when there are fewer than 5 comparables.
13. **Regulated activities.** Casvitta is not an auctioneer and does not offer fund quotas, CRIs or other securities; those pages carry the disclaimers in the mockups. Owner requests are assigned to a CRECI-registered broker (manually by staff at first).

## 5. Core data model (starting point — refine with migrations, keep names)

- `workspaces` (tenant: a broker or an agency), `users`, `memberships` (role: owner, admin, broker, assistant)
- `broker_profiles` (user_id, display_name, creci_number, creci_state, creci_verified_at, slug, bio, photo_url, regions[])
- `properties` (workspace_id, kind, transaction: sale/rent, address fields + geo, area_m2, bedrooms, parking, condo_fee_cents, iptu_cents, price_cents, status, features[], is_demo)
- `property_media` (property_id, kind: photo/floorplan/video, url, position, is_cover)
- `owner_authorizations` (property_id, kind, exclusive, signed_at, expires_at, document_url)
- `listings` (property_id, channel: marketplace/landing/meta/google, status, external_id, published_at) and `ad_creatives` (listing_id, title, body, highlights[], source_map JSON, generated_by_ai, prompt_version, approved_by, approved_at)
- `campaigns` (property_id, daily_budget_cents, max_spend_cents, starts_at, ends_at, status, region JSON)
- `leads` (workspace_id, property_id, person_id, source, campaign_id, acquisition_cost_cents, stage: new/qualifying/qualified/visit_booked/visit_done/proposal/won/lost, qualification JSON: financing_pct, uses_fgts, fgts_cents, down_payment_cents, household_income_cents, timeframe)
- `people` (name, phone_e164, email) + `consents`
- `conversations` (lead_id, channel: whatsapp/instagram/facebook/marketplace, ai_mode: active/paused/handed_off, handoff_reason) and `messages` (sender: lead/ai/human/system, body, external_id, sent_at, status)
- `availability_slots`, `appointments` (lead_id, property_id, starts_at, status: proposed/confirmed/done/cancelled/no_show, reminders JSON)
- `proposals` (lead_id, property_id, amount_cents, payment: cash/financed/mixed, conditions, deadline_days, status)
- `landing_pages` (owner: broker or property, slug, published) — generated from existing records, not edited as free HTML
- `social_accounts`, `social_posts` (scheduled_at, status: suggested/awaiting_approval/scheduled/published, channels[])
- `ledger_entries`, `module_interest`, `audit_log`, `events` (property lifecycle timeline: entity, type, payload, occurred_at)
- `interest_signups` (platform-level, not per workspace: kind: agency/owner_listing/developer/investor_institutional/rental_admin/auction, name, phone_e164, email, criteria JSON validated per kind, utm_source/medium/campaign, source_page, status: pending_opt_in/confirmed/unsubscribed, opt_in_requested_at, opt_in_confirmed_at, assigned_broker_id for owner requests) + `interest_signup_consents` (purpose, granted, granted_at, source)

## 6. Anchor flows (each must work end to end, with Playwright tests, against fake adapters)

1. **Door 1:** select property (blocked if no authorization) → AI generates ad (title, description, highlights, with source per claim) → broker edits/approves → choose channels + daily budget (free amount ≥ R$ 20/day, with suggestions R$ 20/30/50; recommended value shown as a range, not a promise) → publish → property landing page + marketplace listing live → simulated lead arrives via WhatsApp → AI asks financing / FGTS / down payment → qualification saved on the lead → AI offers two free slots → appointment confirmed → weekly report shows spend, leads, cost per lead, cost per booked visit, by channel.
2. **Door 2:** dashboard "Precisa de você" (items needing a human) → Kanban → lead detail timeline → inbox with AI handoff (draft reply marked "Rascunho da IA · revise antes de enviar") → calendar → proposals side by side (proposal → "Gerar contrato · em breve" disabled).

Demo persona for seeds (all fictitious, `is_demo=true`): broker Ana Ribeiro, CRECI-SP 000.000-F; property "Apartamento · Rua Domingos de Morais, Vila Mariana", R$ 690.000, 68 m², 2 quartos, 1 vaga, condomínio R$ 820; leads Marcos T., Júlia P., Rafael M., Bianca S., Pedro A.

## 7. How to work in this repo

- Before building a screen, open its mockup in `docs/mockups/` (see the README there) and match it; list in your plan which mockups the task covers. Where a mockup conflicts with these docs, the docs win (see `docs/mockups/DEVIATIONS.md`).
- Plan before large changes: for any task touching more than ~3 files, write a short plan (files, migrations, tests) and wait for approval.
- Small, reviewable commits with Conventional Commit messages in English.
- Every feature: migration + service + router + tests (backend) and screen + component stories + test (frontend). Keep routers thin; logic in services.
- Generate the TS client after any API change (`pnpm api:gen`) and commit it.
- Never commit secrets. `.env.example` lists every variable. Integrations default to fake adapters when credentials are missing.
- Run `make check` (ruff, mypy, pytest, eslint, tsc, vitest) before saying a task is done, and report what you ran.
- If a requirement here conflicts with a task request, stop and ask.
