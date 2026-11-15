# Kickoff prompt for Claude Code

Put `CLAUDE.md` at the repo root, `docs/DESIGN_SYSTEM.md` under `docs/` and the `design/` folder (tokens.json, logo-mark.svg) at the root, then paste the prompt below as your first message. The milestone prompts after it are for the following sessions, one at a time.

---

## Prompt 1 — Foundation (paste this first)

```
You are the founding engineer of Casvitta. Read CLAUDE.md and docs/DESIGN_SYSTEM.md completely before anything else; they are binding.

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

---

## Prompt 2 — Core domain + Broker OS (next session)

```
Milestone 1: core domain and Broker OS (Door 2), against fake integrations.

Backend: models, migrations, services, routers and tests for accounts/workspaces/memberships, broker_profiles (CRECI required to publish), properties + media + owner_authorizations (publication gate per CLAUDE.md §4.2), people + consents, leads (stages, qualification JSON, acquisition cost), conversations + messages (ai_mode, handoff_reason), availability_slots + appointments, proposals, events timeline, audit_log, module_interest. Seed script with the demo persona from CLAUDE.md §6, all is_demo=true.

Frontend (apps/web (app)): Dashboard ("Precisa de você", Hoje, Funil agora), Imóveis list + property form with authorization step, Leads Kanban (drag + keyboard move), Lead detail (timeline, qualification panel, simulation), Conversas inbox (list with tabs Precisa de você / IA / Todas, thread, AI draft composer, take over / hand back), Agenda week view with free-for-AI slots, Propostas side-by-side with "Gerar contrato · em breve" disabled, Loja de módulos with Ativo / Disponível / Em breve. Mobile: Conversas and Agenda.

Playwright: anchor flow 2 from CLAUDE.md §6. Plan first, then build.
```

## Prompt 3 — Ads Studio, marketplace and landing pages

```
Milestone 2: Door 1 up to "published".

Ads Studio 3-step flow (Imóvel → Anúncio → Publicar): property picker blocking unauthorized properties; AI ad generation job (title ≤ 40 chars, description ≤ 125, highlights) that returns a source field for every claim and refuses facts not in the record — versioned prompt + Pydantic output schema + tests with the fake LLM and a few recorded real-LLM fixtures; editor with "Gerar outra versão"; channels (Página do imóvel, Marketplace, Instagram e Facebook, Google) and BudgetPicker; campaigns with hard spend cap; publish creates listings and landing pages.

Marketplace (pt-BR, mobile-first, SSR): search with filters, results list + map, property detail (gallery, specs, financing simulation, "Pergunte sobre este imóvel" AI box answering only from the record, visit request), sponsored badge. Broker landing page and property landing page on subdomains, with OpenGraph images and schema.org markup.

Plan first, then build. Playwright: anchor flow 1 up to "listing live".
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

Meta Marketing API (campaign/ad set/ad creation, budget, region targeting, status sync, spend ingestion into the ledger, rejection reasons surfaced as the ErrorState copy in DESIGN_SYSTEM §7), Google Ads (Performance Max or Search for a single property, same contract), Facebook Page + Instagram professional account connection, weekly AI-suggested posts (carrossel, reels, story) that require approval, scheduling and publishing, comments and DMs ingested into Conversas. Document the Meta app review permissions we need in docs/META_APP_REVIEW.md. Plan first.
```
