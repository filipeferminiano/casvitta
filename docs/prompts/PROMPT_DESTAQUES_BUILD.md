# Prompt for Claude Code — Destaques (Casvitta Ads) and AdOps

Paste the block below into Claude Code at the repo root. It depends on a real listings table (see PROMPT_SOCIAL_BUILD.md §1) and on billing; the plan step says what to stub until those exist.

---

```
Build Destaques (internal name Casvitta Ads): paid sponsored placement of a property inside the Casvitta portal, bought self-service by owners, brokers and agencies, plus the AdOps area in the backoffice. Approved mockups: docs/mockups/destaques/ (customer journey 01–24, AdOps 40–51; see its README). Read CLAUDE.md, docs/DESIGN_SYSTEM.md and the mockups README first. Rebuild with packages/ui; never paste inline styles. CLAUDE.md wins on conflicts; flag them.

## Model (non-negotiable)
- Fixed price per period, from config (hypotheses: 7 dias R$ 39, 30 dias R$ 119). No auctions, bids, cost-per-click or algorithm settings for customers.
- A highlight needs an active normal publication covering the whole period (plan-included or one-off). Buying a highlight never replaces publishing.
- Days count only while the campaign is delivering: not during review, waiting for start, or pauses.
- Sponsored cards appear only in searches whose filters the property matches, always labeled "Patrocinado". No guarantee of position, contacts, sale or rental. No Google/Meta/other portals.
- Three independent statuses per campaign: payment (Pix pendente, Processando, Pago, Recusado, Reembolso solicitado, Reembolsado), review (Em análise, Aprovada, Aguardando correção, Reprovada) and delivery (Não iniciada, Agendada, Ativa, Pausada, Interrompida, Encerrada).

## 0. Fix what exists first
- Today `sponsored` in the marketplace is derived from a live Ads Studio (Meta/Google) campaign (apps/web/src/lib/data/marketplace.ts). Decouple it: sponsored = an active Destaque campaign only. Ads Studio stays as "Anúncios" (Meta/Google) and never makes a listing sponsored.
- Rename the public badge "Destaque pago" → "Patrocinado" (SponsoredBadge). In customer UI the module is "Destaques", the button "Promover imóvel".
- Search ordering: replace "sponsored always first" with the distribution rules in §4.

## 1. Data
- `highlight_orders` (buyer workspace or owner account, property, package, price snapshot, availability snapshot with expiry, payment refs), `highlight_campaigns` (id format DST-YYMM-NNNN, the three statuses, planned/actual start and end, delivered days, responsible staff, notes), `highlight_events` (visible impression, valid click, contact started; with search context), `capacity_rules` (region × transaction × property type: max simultaneous campaigns, margin %, sales suspended, blocked dates), `refunds` (amount, reason, requested_by, approved_by, provider status), audit entries for every staff action.
- Money in integer cents. Prices and limits in config with an effective date.

## 2. Customer journey (mockups 01–24)
Build exactly the screens and states: entry points (property list, property page, "Meus destaques"); eligibility cards (eligible, incomplete listing, expired publication, publication ending before the highlight with renew/adjust and separate costs, unavailable, active/scheduled → open it, no duplicate purchase); package + "Patrocinado" preview + where it can appear; availability check (available / limited with next date / none with future date or free alert / low expected demand without invented numbers); review with separate publication and highlight lines, start-of-count explanation, inclusions/exclusions, cancellation/refund text marked "pendente de definição"; payment states (processing, Pix pending, declined, confirmed, availability reservation expired → mandatory re-review on any price/date change); confirmation timeline; correction-needed state; tracking (visible impressions, valid clicks, contacts started, derived cost per contact with "sem dados" when zero, daily chart, history, receipt, help, renewal subject to availability); campaign states (no results, paused, ended, property marked rented → delivery stops immediately, financial case opened). Desktop and mobile.

## 3. AdOps backoffice (mockups 40–51)
Backoffice host, new section "Destaques · AdOps": Visão geral (financial vs delivery KPIs separated; prioritized problem queue), Campanhas (table, filters, saved views, export), campaign detail with tabs Resumo/Entrega/Qualidade/Financeiro/Histórico and actions (approve, reject with reason, pause/resume, reschedule, extend as compensation, open refund request, assign, internal note; every customer-affecting action needs confirmation + reason; messages to customers are drafted, never auto-sent), Capacidade e inventário (heatmap region × day; observed audience, projection, commitments, reserved, margin, availability; controls), Distribuição (rules + alerts + "Experimentos" area without bandits), Qualidade (signals as suspicions, never "fraud"), Financeiro (pending/confirmed/declined, paid-not-started, refunds requested vs completed, divergences, possible duplicates, reconciliation), Relatórios (observed only; RPM formula visible), Experimento (concept screen), Anunciantes, Histórico de ações.
Permissions: Consulta, Operação, Administração, Financeiro exactly as in 43-adops-campaign-tabs-permissions, enforced in the API. Price, capacity and margin changes need Administração; refund approval needs Financeiro.

## 4. Serving and measurement
- Rules (config): respect filters and availability; relevance + controlled rotation among eligible campaigns; max 2 sponsored per results page; max 3 exposures of the same property per visitor per day; max 30% of a region's exposure per advertiser.
- Definitions (propose and document): visible impression (e.g. ≥ 50% of the card on screen for ≥ 1 s), valid click (deduplicated, excludes suspected invalid traffic), contact started (tap on WhatsApp/call/message; never "lead" or "conversation").
- Capacity check is required before payment; availability is reserved for 30 min (config) during checkout.
- Recognized revenue = paid amount pro rata to delivered days (hypothesis; confirm with accounting). Paid ≠ recognized.

## 5. Payments
- Stripe one-off payments (Pix and card) behind `HIGHLIGHTS_BILLING_ENABLED`. Check in the plan that Pix one-off payments are available for our Stripe account in Brazil; if not, propose an alternative. Until billing is on, run the whole flow in test mode in non-production only.
- Refunds: "Solicitar reembolso" creates a request; only a provider confirmation marks it refunded.

## 6. Scenarios to seed and test (same IDs in customer and backoffice)
1 Corretor assinante buys 7 days, paid, active (DST-2611-0042). 2 Owner renews publication before 30 days (DST-2611-0047, Pix pending). 3 Agency without capacity schedules 02/12 (DST-2611-0051). 4 Paid campaign blocked by incomplete listing (DST-2611-0055). 5 Low delivery investigated and extended within capacity (DST-2611-0049). 6 Property rented mid-campaign, delivery stopped, refund requested (DST-2611-0038).

## Process
1. Reply with a plan: dependencies (listings, billing) and what you stub, data model, serving integration with search, event pipeline, capacity computation, permissions, and conflicts. Wait for my "go".
2. Small commits: decouple sponsored → data model → customer journey → payments (test mode) → serving + events → AdOps screens. Run `make check`; Playwright covers the six scenarios.
```

---

## Before pasting
- Mockups: `docs/mockups/destaques/`.
- Pending decisions (marked ⚑ in the screens): cancellation/refund policy, review and correction deadlines, final prices, reservation time, recognized-revenue rule, visible-impression definition.
