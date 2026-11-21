# Prompt for Claude Code — Casvitta CRM, automations, agents and broker success

Paste the block below into Claude Code at the repo root. It is split into milestones; Claude Code should plan first and wait for "go".

---

```
Build the Casvitta CRM for brokers: contacts, pipeline and visit calendar; WhatsApp and Instagram automations; conversational AI agents that book visits; saved-search alerts, QR signs, owner reports and network message tests; plus the backoffice screens to run it (messaging compliance, agent quality, broker activation and maturity). It also unifies plans and prices and updates the brokers landing page.

Approved mockups:
- docs/mockups/crm/ (see its README; replaces Broker OS mockups 31–33)
- docs/mockups/backoffice/ 09–16
- docs/mockups/landing-pages/02-brokers and 00-prices-hypotheses (replaced)
Read CLAUDE.md, docs/DESIGN_SYSTEM.md, docs/mockups/README.md and the READMEs above first. Rebuild with packages/ui components and tokens; never paste inline styles from the HTML. If a mockup conflicts with CLAUDE.md, CLAUDE.md wins; flag it in DEVIATIONS.md.

## Product rules (non-negotiable, add tests)
- Every property shown publicly has a verified broker CRECI and a valid owner authorization. Every CRM property generates its listing page on the Casvitta site (casvitta.com.br/imovel/…) after those checks, using the same listings table as the portal and the broker page.
- Never invent data. Missing fees render "Não informado". Automated messages and agents use only fields from the property record, the broker's FAQ and the calendar; if a needed field is missing they say they will confirm and hand off.
- Consent per channel and purpose, never pre-checked, with proof stored (who, when, where, text shown). SAIR stops marketing immediately. Marketing messages only 8h–20h, max 2 per contact per week (configurable), across all automations and alerts combined. Instagram → WhatsApp only when the person asks.
- WhatsApp click ≠ message sent; a click is not a lead. Reports separate observed numbers from incremental effect (control group).
- AI agents always identify themselves as a virtual assistant, never negotiate price or terms, never promise credit or approval, never ask for CPF, documents or bank data, never talk about properties outside the broker's portfolio, and stop when the person asks for a human. These are global rules that brokers cannot turn off.
- Conversations and contacts belong to the broker. Staff see counts and events only; opening a conversation requires a registered support request and is audited.
- All pt-BR copy in the message catalog. Demo data (`is_demo`) never appears on real pages.

## What already exists (build on it, do not duplicate)
- hosts.ts routing (marketplace, app, backoffice, `{slug}.casvitta.com.br` → /l/[brokerSlug]); email-link sign-in; workspaces, memberships, roles; staff roles, permissions and audit on the backoffice host; CRECI verification (BO2); interest and alerts domains; offer catalog in config.
- Work in progress in this branch (uncommitted at the time of writing): `apps/api/app/domains/properties/`, `apps/api/app/domains/listings/`, `apps/api/app/api/v1/properties.py` and migration `20261121_0015_properties_media_authorizations_listings`. Read them first; extend them rather than creating parallel models. If they are unfinished, tell me what is missing in your plan.
- Destaques (sponsored placement) and Ads Studio (Meta/Google campaigns) are separate modules; the CRM only links to them.

## 1. Plan catalog and entitlements (milestone CRM-0, do first)
One catalog in config, consumed by API gates, web gates, the landing pages, the prices page and llms.txt. It replaces every other price table (R$ 197/397 in code; R$ 99/299/499 on the landing pages; Bio/Social names and limits of PROMPT_SOCIAL_BUILD §5). In your plan, list every consumer you find and migrate them all.

| key | Display | Monthly | Annual (per month) | Users | Active properties | CRM contacts | Contacts in automation / month | Journeys | AI agents | AI conversations / month | Included Destaques (7 d) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| free | Grátis | 0 | — | 1 | 5 | 100 | — | — | — | — | — |
| essential | Essencial | 49 | 41 | 1 | 30 | 2.000 | — | — | — | — | — |
| automation | Automação | 149 | 124 | 1 | 100 | unlimited | 1.000 | 3 | 1 | 200 | — |
| pro | Pro | 299 | 249 | 2 | 300 | unlimited | 5.000 | unlimited | unlimited | 1.000 | 1 |
| agency | Imobiliária | from 499 | 416 | 5 (+59 each) | 1.000 | unlimited | 15.000 | unlimited | unlimited | 3.000 | 3 |

Feature flags per plan follow the table in 00-prices-hypotheses/prices (page without Casvitta brand from Essencial; custom domain, WhatsApp official, comment-to-DM, Google Calendar, segments from Automação; distribution and permissions only Imobiliária). Add-ons: +500 AI conversations R$ 49; +1.000 contacts in automation R$ 39; extra agency user R$ 59. Destaques avulsos R$ 39 (7 d) / R$ 119 (30 d) in every plan. Owner one-off listing R$ 59 (30 d) / R$ 149 (90 d) stays separate.
Definitions (put them in code and in the FAQ): active property = published or draft (sold, rented, paused don't count); AI conversation = a conversation where the agent replied, counted once per 24 h; contact in automation = received at least one automated message in the month.
Limits: warn at 80%; at 100% nothing is charged automatically: automations pause and agents hand conversations to the broker until the broker buys an add-on or the month renews.
Billing: if billing is still not wired, keep plan changes as staff-assigned upgrade requests behind a flag, as in the Social prompt, with checkout states ready for a payment provider.
Then rebuild /para-corretores (02-brokers desktop + mobile) and the prices page (00-prices-hypotheses) from the mockups, and update /para-imobiliarias pricing to the "Imobiliária" plan. Note for the plan: SOC-1 named the plans Bio/Social; the catalog now uses Grátis/Essencial. Migrate names and limits consistently.

## 2. CRM core (milestone CRM-1; mockups 00–05, 15, 18, 19, 23, 40)
- Data model (propose, then migrate): contacts (name, provided phone/handle/e-mail, source with UTM/QR/sign/page/portal, owner vs buyer/tenant, interests: purpose, neighborhoods, price range, bedrooms, parking), consents (channel × purpose, status, proof, revoked_at), conversations and messages (channel, direction, author: contact / broker / automation / agent), pipeline stages (configurable, default Novo → Em conversa → Visita marcada → Proposta → Fechado / Perdido), tasks/next steps, visits (property, slot, status, confirmations), calendars (Casvitta calendar + Google Calendar free/busy only), key events table (see §7).
- Screens: Contatos, Contato 360, Funil, Cadastrar imóvel → publicação (gates and preview exactly as 04), Publicado (05: where it appears, matching contacts), Caixa de entrada (desktop + mobile, take over from bot), Agenda de visitas (23: visit length, buffers, lead time, days ahead, neighborhoods per day), Início with "Primeiros passos" and the suggested next step (40).
- Visit scheduling is a service with conflict checking at commit time (re-read availability before creating; the slot-taken state in 26 must be real).

## 3. Channels and automations (milestone CRM-2; mockups 10–17)
- WhatsApp: the broker's own WhatsApp Business number via the WhatsApp Business Platform (Cloud API) with Embedded Signup; Meta bills messages to the broker's account. Templates are submitted and tracked per account (states in 13). Respect the customer service window for free-form replies; outside it only approved templates. Instagram: Instagram API messaging for professional accounts (comment-to-DM, DMs). Verify current Meta policies, pricing categories and windows before coding and put what you find in docs/integrations/meta.md; propose a sandbox/mocked mode for local and CI.
- Automations: templates hub (10), Instagram comment keyword → private reply (12, with limit states), journey builder (11) with blocks trigger / rule / condition / wait / message / hand off / end; no loops, every path ends; validation before activation (approved template, test sent, preview of who would receive today, consent rule on).
- Control group: deterministic 10% holdout per journey (hash of contact id + journey id), stored on the send log; reports (16) show observed vs incremental with confidence intervals.
- Segments (14) as saved filters over contacts/interests/events. Usage meters and Meta cost estimate on 17.
- Delivery pipeline: a queue/worker for outbound messages with idempotency keys, rate limits per number, quiet hours, weekly cap check at send time, and webhook ingestion for inbound messages, statuses and opt-outs (SAIR keyword).

## 4. Conversational agents (milestone CRM-3; mockups 20–26, backoffice 10)
- Agent = template + objective + success condition + tone + knowledge sources + tool permissions + hand-off rules + channels, versioned (draft vs published).
- Tools are server-side functions with a permission mode per agent: `auto`, `needs_approval`, `off`. Initial tools: get_property, get_free_slots, book_visit, reschedule_or_cancel_visit (only visits of this contact), upsert_contact, move_pipeline_stage, send_listing_link, suggest_similar (own portfolio only), handoff_to_broker. The model never queries the database directly.
- LLM behind a provider interface (no vendor lock-in); prompts and fixed rules in versioned files. Deterministic post-checks before any message is sent: prices, fees, areas and dates mentioned must match the property record or the calendar; forbidden topics (discount, negotiation, credit, documents) force hand-off. Log every tool call (the trace shown in 24 and 26 to the broker only).
- Hand-off: notify in app + inbox; if the broker doesn't answer in 15 min, tell the person the broker will reply soon; after hours schedule for 8h. When the person asks for a human, the agent stops in that conversation.
- Test sandbox (24): scenarios, simulated channel, no real messages or visits. Review (25): flag a wrong answer → correction as a property data fix or a new rule, applied in the next published version.
- Metering: count AI conversations per §1; token/cost logging per account for our unit economics (internal only).
- Backoffice 10-agent-quality: flagged answers, complaints, hand-off rates per account; global rules editable only by staff with audit.

## 5. Postscript-inspired growth features (milestone CRM-4; mockups 30–37)
- Saved searches (31, 32): created from the broker page form (consent checkbox), from a conversation, or by the broker. Matching on publish and on price drop: purpose, neighborhood, price within ±3% (config), bedrooms, optional parking/type. Expiry 90 days with a "still looking?" template 3 days before. Notify screen (30): matches, consent per channel, who will receive now vs queued by the weekly cap, manual-only for contacts without WhatsApp consent, optional auto-notify for future properties.
- QR signs (33, 34): short link casvitta.com.br/p/{code} logs the scan and redirects to wa.me/{broker number}?text=PLACA%20{code}; inbound "PLACA {code}" (with or without scan) starts the sign flow: service reply with property data, buttons, visit booking, consent asked inside the conversation; sold/unavailable property replies with alternatives. Sign generator: type, size, CRECI mandatory, PDF for print + PNG. Stats: scans, conversations, visits per sign; contact source = Placa.
- Objections and owner report (35, 36): classify conversation snippets per property into themes (blockers vs attractors) with counts; broker can correct a theme; show anonymized quotes only to the broker. Owner report: monthly numbers, themes (only if ≥5 conversations), neighborhood price per m² comparison (only if ≥20 comparable active listings; show source and that asking price ≠ sale price), broker's suggested next step; reviewed by the broker before sending; shareable link without personal data; track opened.
- Network message tests (37, backoffice 16): staff define template variants (AI-generated, human-reviewed). Allocation across all brokers who opt in to "use the network winner", plus a no-message control where the template is optional (alerts). Primary metric is visit booked within 7 days, never clicks. Guardrail: SAIR or reports above 2% pause the test automatically. Declare a winner only when the CI excludes 1 and a minimum sample is reached; report ratio with 95% CI. Brokers see the network result and their own small-sample numbers with a "too little volume to conclude alone" note. Only counts (sends, replies, visits) leave the broker account.

## 6. Messaging compliance in the backoffice (backoffice 09)
Per account: SAIR rate (7 d), reports, WhatsApp number quality rating, rejected templates, disconnected Instagram; pause an account's automations with a mandatory reason (audited); consent proof export for LGPD requests; conversation access only with a support request. Signals are prompts for a conversation with the broker, not automatic punishment (except the global auto-pause thresholds).

## 7. Broker success: activation and maturity (backoffice 11–15, app 40)
- Key events (counted as activity): reply to contact, move contact in pipeline, create/edit/publish property, activate or edit automation/agent. Not activity: login only, page open, actions done by the agent alone. Weekly active = ≥1 key event in 7 days.
- Levels are milestone-gated: N0 Cadastro (account) → N1 Presença (CRECI verified + 1 property + page published) → N2 Atendimento (channel connected + first contact answered in the CRM) → N3 Automação (automation or agent active with a result in 30 d) → N4 Escala (10+ properties, pipeline used weekly, team or Destaques).
- Score 0–100 inside the level: Presença 25, Atendimento 30, Automação 25 (wrong agent answers subtract), Atividade 20 (active days in the last 28). Weights in versioned config; changing them creates a new version and recomputes history. The score is never shown to the broker as a grade and never affects marketplace ranking.
- Screens: 11 (onboarding funnel for accounts created in the last 90 days, level distribution with 30-day movement, weekly cohort retention), 12 (list with segments: stuck in onboarding, at risk, ready to level up, no CS contact in 30+ days; bulk assign / apply playbook), 13 (broker 360: checklist, module usage heatmap, signals, up to 3 next steps with "why" and "measured by", CS contact log), 14 (playbooks), 15 (method page as in-app documentation).
- Playbooks = rule (trigger → action → goal) with a fixed 10% holdout, caps (max 1 CS contact and 2 automated tips per broker per week; broker can turn tips off), status "Funciona" only when the CI excludes zero. Seed the six playbooks of mockup 14. Next steps feed both the CS queue and the broker's Início (40).
- Jobs: nightly computation of levels, scores, signals and next steps; idempotent; backfill command.

## Tests
- API: entitlements for every catalog row and limit behavior at 80%/100%; consent and caps (quiet hours, weekly cap across automations + alerts, SAIR); holdout assignment determinism; template/window rules; agent tool permissions, post-check blocking of invented numbers and forbidden topics, hand-off triggers; visit conflict at commit; saved-search matching and expiry; QR scan + keyword parsing; owner report thresholds; experiment guardrail auto-pause and winner rule; maturity levels and score on fixtures; staff conversation access audited.
- Web: stories for every state in the mockups; 390 and 1440 where mocked; accessibility.
- Playwright: (1) free broker → publish first property → listing page live after checks; (2) contact comments keyword on Instagram (mocked) → DM → books a visit through the agent → appears in pipeline and calendar → confirmation template the day before; (3) new property → notify matching contacts respecting caps; (4) QR scan → WhatsApp keyword → visit; (5) broker flags a wrong agent answer → correction → next version; (6) owner report generated, reviewed, opened; (7) staff applies a playbook and sees it in the broker 360; (8) plan limit reached → automations pause → add-on request.

## Process
1. Reply with a plan: data model and migrations (and how they extend the in-progress properties/listings work), Meta integration approach and current policy findings, LLM provider interface and guardrail design, queue/worker choice, price catalog consumers, experiment statistics, and conflicts with CLAUDE.md. Wait for my "go".
2. Milestones in order: CRM-0 catalog + landing/prices → CRM-1 core → CRM-2 channels and automations → CRM-3 agents → CRM-4 growth features → backoffice (compliance, agent quality, broker success). Small commits; run `make check` after each milestone and report.

Open decisions (assume the default, list them in the plan): saved-search alerts available from Essencial (default: Automação, since they need WhatsApp); ±3% price tolerance; neighborhood comparison minimum 20 listings; Destaques included in Pro/Imobiliária; AI conversation limits pending a cost-per-conversation check.
```

---
