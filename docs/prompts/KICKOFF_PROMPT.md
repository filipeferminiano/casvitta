# Kickoff prompt for Claude Code

Put `CLAUDE.md` at the repo root, the `docs/` folder (DESIGN_SYSTEM.md and mockups/) and the `design/` folder (tokens.json, logo-mark.svg) at the root, then paste Prompt 1 as your first message. The prompts after it are for the following sessions, one at a time, in order (1 → 1b → 1c → 2 → 3 → 4 → 5). See Status for where we are.

---

## Prompt 1 — Foundation (paste this first)

```
You are the founding engineer of Casvitta. Read CLAUDE.md and docs/DESIGN_SYSTEM.md completely before anything else; they are binding. Look at docs/mockups/README.md and at least the design-system, dashboard and Ads Studio PNGs so you understand the visual target.

Goal of this session: Milestone 0 — a running monorepo foundation with the design system, ready for feature work. Do not build product features yet.

Deliver:
1. Monorepo scaffold exactly as in CLAUDE.md §3: pnpm workspaces + Turborepo, apps/api (uv, FastAPI), apps/web (Next.js App Router, TS strict), packages/ui, packages/config, packages/api-client, infra/docker-compose.yml (Postgres 16, Redis), Makefile with `dev`, `check`, `test`, `api:gen`, `db:migrate`, `db:seed`.
2. Backend skeleton: settings via pydantic-settings, async SQLAlchemy session, Alembic configured, health endpoint, structured logging, error handling that returns pt-BR user messages with English error codes, multi-tenant base model (workspace_id) with a test that proves cross-tenant reads are impossible, money helpers (integer cents) and core/finance.py with SAC and Price installment functions + tests.
3. Integration ports with fake adapters (no real calls yet): llm, whatsapp, meta_ads, google_ads, social (Facebook/Instagram pages), storage, email/sms. A FAKE_INTEGRATIONS=true default.
4. Design system in code: tokens.ts → CSS variables → Tailwind preset; next/font for Familjen Grotesk, IBM Plex Sans, IBM Plex Mono; logo assets from §4. Build in packages/ui, with Storybook stories covering every state: Button, IconButton, Input (with error), CurrencyInput, Select, Checkbox, Switch, SegmentedControl, Tabs, Badge (Demonstrativo, CRECI, Feito por IA, Simulação, Em breve, Destaque pago), Chip, StatusPill, StatTile, DataTable, EmptyState, LoadingState, ErrorState.
5. App shell in apps/web: route groups (marketplace), (landing), (app); next-intl with pt-BR catalog; Broker OS side navigation (Início, Imóveis, Leads, Conversas, Agenda, Propostas; Módulos: Ads Studio; Loja de módulos, Configurações) and mobile bottom tabs; middleware rewriting {slug}.casvitta.com.br to the (landing) group. Placeholder pages use EmptyState with real pt-BR copy.
6. CI (GitHub Actions): lint, typecheck, tests for both apps; Storybook build.

Process:
- First reply with a plan: directory tree, key libraries with pinned versions, and anything in CLAUDE.md you think is wrong or underspecified. Wait for my "go".
- Then implement in small commits. Run `make check` at the end and report exactly what passed.
- Keep all code and comments in English; all UI copy in pt-BR through the catalog.
```

## Status (updated 15/11/2026)

- Done: Prompt 1 (Milestone 0: monorepo, API skeleton, fake adapters, design system, shell, CI) and Prompt 1b (Milestone 0.5: every mocked screen 04, 10–17, 20–26, 30–37, 40–42 built with mock data, /dev/screens, screens:capture, docs/mockups/DEVIATIONS.md).
- Still placeholders: the marketplace home (a plain listing grid), /comprar, /alugar, /entrar, /favoritos, /minhas-visitas, /app/imoveis, /app/configuracoes.
- Backend: only health and the accounts models. No domain endpoints yet.
- Next: Prompt 1c (public site, screens 50–61), then Prompt 2.

---

## Prompt 1c — Public site journeys (casvitta.com.br)

```
Milestone 0.6: the public site at casvitta.com.br. Milestones 0 and 0.5 are done; build on what exists, don't redo it.

Read first: CLAUDE.md (rules 11–13 are new), docs/mockups/README.md section "Public site journeys", docs/mockups/50-journey-map.png (each audience, its steps, where it lands in the product) and docs/mockups/DEVIATIONS.md. The decisions in DEVIATIONS.md win over screens 50–61 too: "Anúncios" instead of "Ads Studio" in every label and URL, budget suggestions R$ 20 / 30 / 50 with a free amount and R$ 20/day minimum, times as 14h03, app routes /inicio and /modulos on the app host, landing pages on {slug} subdomains. Where a new mockup contradicts one of these, follow DEVIATIONS.md and add a row for the new screen.

Reuse before you build: packages/ui already has PropertyCard, PropertyRow, FinancingSimulation, BudgetPicker, Stepper, SegmentedControl, Field, Input, Select, Checkbox, Chip, Badge, Panel, States, Logo, PhotoPlaceholder, Toast; apps/web has screens/marketplace (MarketplaceNav, ListingGrid, ListingIslands, PropertyDetail, BuyerScreens) and lib/data/marketplace.ts. Extend these instead of creating parallel versions. New components go in packages/ui with stories.

Replace the placeholders:
- 51 / 52 → (marketplace)/page.tsx: today it is a plain listing grid. Build the home: search with Comprar/Alugar, shortcuts (Aceita FGTS, Perto do metrô, 2+ quartos, Aceita pet), featured listings, how it works, financing teaser, the dark "Você é…" block (Proprietário, Corretor, Imobiliária, Incorporadora "Em breve"), trust strip.
- 53 → /comprar and /alugar: results list + map, filter chips kept in the URL, sponsored listing first and labeled, sort, "Salvar busca" (mock), per-card simulated installment. ?modo=investir adds estimated rent and gross yield per card under CLAUDE.md rule 12 (hidden below 5 comparables).
- Header and footer: update MarketplaceNav to the mockup header (Comprar, Alugar, Anunciar imóvel, Para corretores, Entrar, "Começar como corretor") and add the shared footer (Para você incl. "Imóveis de leilão", Para profissionais incl. "Investidores", Casvitta, WhatsApp +55 11 92740-8912, CRECI-J from config, still the [NÚMERO] placeholder). Apply both to every (marketplace) page, including the existing 13, 25 and 26.
- /entrar: phone OTP sign-in that reuses the "Conta" step component of /cadastro (mock verification for now).

New routes, all in (marketplace), SSR, mobile-first:
- 54 → /para-corretores (how it works, what's included, plans from config, the R$ 1.497 vs R$ 397 comparison block with its footnote, #imobiliarias section with "Quero ser avisado do Agency OS" → module_interest/interest signup kind=agency)
- 55 → /cadastro/[step] with conta → creci → whatsapp → plano → primeiro-imovel. UI through the mock data layer in this milestone (real auth is Milestone 1). CRECI step creates a pending verification; last step hands off to /anuncios/novo on the app host. Publishing stays blocked until the CRECI is verified (rule 1). Mind the cross-host sessionStorage note in DEVIATIONS.md: pass the handoff explicitly instead of relying on shared storage.
- 56 → /anunciar-imovel (owner form + "O que acontece depois"; kind=owner_listing and a staff task to assign a broker)
- 57 → /incorporadoras ("Em breve" + waitlist; kind=developer)
- 58 → /investidores (#pf links to /comprar?modo=investir and a rental_admin waitlist; #gestores: five "Em breve" fronts, pilot steps, CVM disclaimer, "Agendar conversa"; kind=investor_institutional)
- 59 / 60 → /leilao (capture only: criteria form, two separate consents, risk box, "A Casvitta não é leiloeira"; kind=auction); 61 → /leilao/confirmado
- 50 is documentation only.

Backend (real, small; this lets the capture pages go live before the rest):
- New domain apps/api/app/domains/interest/ following the accounts domain conventions; interest_signups model as in CLAUDE.md §5 with a Pydantic criteria schema per kind; Alembic migration in apps/api/migrations/versions.
- POST /v1/public/interest: no auth, rate-limited, honeypot field, consents stored per purpose with timestamp and source, UTM/source stored.
- WhatsApp double opt-in through the existing fake adapter in app/integrations/whatsapp: send the confirmation, set opt_in_confirmed_at when the reply is "SIM"; nothing else is sent before opt-in.
- GET /v1/admin/interest (filter by kind, CSV export) protected by an admin token setting until auth exists.
- Regenerate packages/api-client. Add lib/data/interest.ts that calls the API when NEXT_PUBLIC_USE_MOCKS=false and the in-memory store otherwise, like the other data modules.

Site basics: per-page metadata and OpenGraph images, sitemap.xml and robots.txt (capture pages indexable, /cadastro and /entrar noindex), schema.org RealEstateListing on listing cards, one track() helper (page_view, search, form_submit, signup_step) with a no-op adapter that respects consent.

Also, outside the public site: the broker's media now runs in their own Meta and Google Ads accounts (CLAUDE.md rule 14, mockup 12 updated). In the existing Anúncios publish step (12, and 20 on mobile) replace the media-charging copy with the new one from docs/mockups/12-ads-studio-3-publish.html, show each paid channel's account status (conectada / conectar / falta cartão na Meta), and when an account isn't connected, the channel toggle opens a "Conectar conta" sheet (mock OAuth) instead of switching on. Página do imóvel and Marketplace never need an account. Add these states to /dev/screens.

Out of scope here (Prompt 2): /app/imoveis, /app/configuracoes, /favoritos, /minhas-visitas, real authentication.

Tests: pytest for the criteria schemas, rate limit, honeypot and opt-in flow; Playwright added to apps/web/e2e/flows.spec.ts for (a) home → /comprar → property detail, (b) /leilao → /leilao/confirmado with the signup stored, (c) /cadastro through to /anuncios/novo with publishing blocked until the CRECI is verified.

Process: reply first with a plan (route table with what is replaced vs new, components reused vs added, migration, endpoints, tests) and wait for my "go". Then one commit per journey, make check after each, add 51–61 to /dev/screens and screens:capture, compare docs/mockups/_impl/ with the mockups, record any intentional difference in DEVIATIONS.md, and finish with the list of what you could not match and why.
```

---

## Prompt 2 — Core domain, auth and the API behind Broker OS (next session)

```
Milestone 1: real backend for Door 2 and swapping the existing screens from mocks to the API. The screens already exist (Milestone 0.5); don't redesign them.

Backend: models, migrations, services, routers and tests for accounts/workspaces/memberships, real auth (phone OTP + email magic link, httpOnly cookies, shared across casvitta.com.br and app.casvitta.com.br), broker_profiles (CRECI verification status; publishing blocked until verified), properties + media + owner_authorizations (publication gate, CLAUDE.md rule 2), people + consents, leads, conversations + messages, availability_slots + appointments, proposals, events timeline, audit_log, module_interest. Seed script with the demo persona and the counts documented in DEVIATIONS.md, all is_demo=true.

Frontend: switch lib/data/{dashboard,leads,conversations,calendar,proposals,modules,broker}.ts to the generated API client (keep the mock path behind NEXT_PUBLIC_USE_MOCKS); wire /entrar and /cadastro to real auth; build the remaining placeholders with the same components and patterns: /imoveis (list with PropertyRow, property form with the authorization step and media upload to the storage port), /configuracoes (perfil e CRECI, WhatsApp, plano e faturas, consentimentos LGPD), /favoritos and /minhas-visitas for buyers. The cross-host sessionStorage limitation in DEVIATIONS.md must disappear.

Playwright: anchor flow 2 from CLAUDE.md §6 against the API. Plan first, then build.
```

## Prompt 3 — Ads Studio, marketplace and landing pages

```
Milestone 2: Door 1 up to "published".

Ads Studio 3-step flow (Imóvel → Anúncio → Publicar): property picker blocking unauthorized properties; AI ad generation job (title ≤ 40 chars, description ≤ 125, highlights) that returns a source field for every claim and refuses facts not in the record — versioned prompt + Pydantic output schema + tests with the fake LLM and a few recorded real-LLM fixtures; editor with "Gerar outra versão"; channels (Página do imóvel, Marketplace, Instagram e Facebook, Google) and BudgetPicker; campaigns with hard spend cap; publish creates listings and landing pages.

Marketplace (pt-BR, mobile-first, SSR): search with filters, results list + map, property detail (gallery, specs, financing simulation, "Pergunte sobre este imóvel" AI box answering only from the record, visit request), sponsored badge. Broker landing page and property landing page on subdomains, with OpenGraph images and schema.org markup.

The Anúncios screens, the property page and the landing pages already exist (Milestone 0.5), and search/results came in Milestone 0.6: build the backend and jobs, then switch their data modules to the API without redesigning. Mockups: docs/mockups/1*.png, 2*.png, 40-*.png, 41-*.png, 53-*.png. Plan first, then build. Playwright: anchor flow 1 up to "listing live".
```

## Prompt 4 — WhatsApp AI agent, scheduling and weekly report

```
Milestone 3: from lead to booked visit, and the report.

WhatsApp Cloud API adapter (real behind a flag, fake by default) with webhook verification and idempotent message ingestion. AI agent as a state machine + LLM: introduce itself as the broker's virtual assistant, ask financing / FGTS / down payment / income / timeframe, save qualification, offer two free slots, confirm appointment, schedule reminders (24h and 2h), post-visit question. Guardrails with tests: never negotiate price, never promise credit, hand off on request, anger or out-of-scope; respect consent and WhatsApp 24-hour window/templates.

Weekly report job (Mondays 08:00 America/Sao_Paulo): spend, leads, qualified, booked visits, cost per lead and per booked visit, by channel, plus one AI suggestion flagged as a hypothesis when the sample is small; deliver in-app and via WhatsApp.

Complete Playwright anchor flow 1 end to end. Plan first.
```

## Prompt 5 — Real ad platforms and social pages

```
Milestone 4: real adapters behind feature flags.

Everything runs on the broker's own accounts (CLAUDE.md rule 14). Meta: Facebook Login for Business to connect the broker's ad account, Page and Instagram account; Marketing API on that account (campaign/ad set/ad creation, budget, region targeting, status sync, reported-spend ingestion for reports (not ledger charges), detection of missing payment method or restricted account, rejection reasons surfaced as the ErrorState copy in DESIGN_SYSTEM §7), Google Ads via OAuth on the broker's own customer account, through our dedicated Google Cloud project with Basic/Standard API access and brand verification and no proxy pattern (Performance Max or Search for a single property, same contract), Facebook Page + Instagram professional account connection, weekly AI-suggested posts (carrossel, reels, story) that require approval, scheduling and publishing, comments and DMs ingested into Conversas (mockup: docs/mockups/42-social-media-calendar.png). Document the Meta app review permissions we need in docs/META_APP_REVIEW.md. Plan first.
```
