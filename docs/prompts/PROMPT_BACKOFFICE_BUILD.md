# Prompt for Claude Code — internal backoffice (staff app)

Paste the block below into Claude Code at the repo root.

---

```
Build the Casvitta internal backoffice from the approved mockups in docs/mockups/backoffice/ (00-routines-map plus BO1–BO8, PNG + HTML, desktop 1440). Read CLAUDE.md, docs/DESIGN_SYSTEM.md and docs/mockups/README.md first. Rebuild with packages/ui components and tokens; never paste inline styles. If a mockup conflicts with CLAUDE.md, the docs win; flag it.

## What exists today (use it, don't duplicate it)
- API admin endpoints behind a single `X-Admin-Token` (deps.require_admin): /admin/brokers (CRECI review), /admin interest list, /admin property alerts list.
- `audit_log` with actor "staff:admin-token".
- Accounts with email-link sign-in, workspaces, memberships and roles (owner/admin/broker/assistant) for customers.
- No listings table in the database, no Stripe, no usage events yet.

## Scope and order
The mockups mark each screen "DADOS REAIS HOJE" (data exists) or "LIGA DEPOIS" (designed, waits for data). Build in this order and never show fabricated numbers in production: screens without data render an honest empty state ("Liga quando a cobrança for ativada", etc.) behind a feature flag per module. Demo data only with `is_demo` in local/dev seeds.

1. Staff access (BO8, prerequisite). Replace the shared admin token with staff accounts:
   - `staff_users` (email allowlist, name, role, active) and roles Admin, Operações, Comercial, Financeiro, Leitura with the permission matrix exactly as in 08-team-audit. Enforce permissions in the API (one dependency per permission), not only in the UI.
   - Sign-in with the existing email-link flow, only for allowlisted staff emails, separate session cookie/audience from customers, short session, re-auth for sensitive actions.
   - Keep `X-Admin-Token` only for scripts/CI behind a setting, and log it as actor "system:admin-token". Every staff action writes audit_log with the real staff actor.
   - Audit screen: filters by person, action and date; CSV export (itself audited).
2. Shell and overview (BO1): dark sidebar with the BACKOFFICE badge, environment badge (PRODUÇÃO / STAGING), global search (accounts, people, CRECI number), "Precisa de você" queue with counts that link to each queue, captures by type, broker funnel (sign-up started → CRECI sent → verified → first property → subscriber). Tiles whose data doesn't exist yet are hidden, not zero.
3. CRECI verification (BO2, real data): tabs Pendentes / Correção pedida / Verificados / Recusados, ordered by oldest; SLA badge after 24 h (the sign-up promises 1 business day); detail panel with the checklist (number exists in the public CRECI lookup, name matches, active, type F/J) and a link to the public lookup of the right UF; actions Aprovar / Pedir correção (reason sent to the broker) / Recusar (reason). Uses the existing /admin/brokers logic.
4. Captures (BO3, real data): tabs by kind (leilão, proprietários, investidores PF, gestores, incorporadoras, imobiliárias, adm. de aluguel, plus the new `owner_listing_start` and `agency_demo` kinds from the landing-pages milestone), filters (status, region, origin/UTM, opt-in), masked phones in lists; revealing a full phone or e-mail is a permissioned, audited action (LGPD). Owner requests: "Indicar corretor" picks a verified broker in the region and sets `assigned_broker_id`; requests without an answer in 24 h go back to the queue. CSV export with permission + audit + only opted-in contacts. Property alerts from the SEO pages appear here too, grouped by scope and intent.
5. Accounts (BO4) and account 360 (BO5): list of customer workspaces with plan, subscription status, CRECI status, active properties vs. limit, leads 30d, last access and a health signal (rules in the mockup legend, as config). The 360 view: KPIs, subscription and invoices, timeline, team with CRECI status, connected ad accounts, actions "Enviar link de pagamento", "Ver como o cliente (somente leitura)" and "Pausar publicações", each with a mandatory reason and audit. Until billing and listings exist, show what we have (workspace, members, CRECI, last access) and empty states for the rest.
6. Listing moderation (BO6, LIGA DEPOIS): queue only for listings that failed an automatic check or were reported; checks: broker CRECI verified, authorization valid and not expired, price vs. comparables, text in photos, duplicates. Build the queue, the checks as pure functions with tests, and the screen; it turns on when the listings table lands.
7. Revenue (BO7, LIGA DEPOIS): revenue by line — SaaS subscriptions, ads (owner one-off listings and paid highlights), commissions (shown as "Em breve": only with Casvitta's CRECI-J and the Rental OS), failed charges, churn. Plan names and prices must come from the offer catalog in config (the mockup shows the old Essencial/Profissional; the new catalog is owner 30/90 days, Corretor, Essencial, Equipe, Operação maior). Media is never revenue: Meta and Google bill the broker directly (CLAUDE.md rule 14). Reads Stripe once billing is wired; until then an empty state.

## Where it lives
- Propose in your plan: a separate host (admin.casvitta.com.br, preferred, using the existing requestSite kinds) or a `(backoffice)` route group under /backoffice. Either way: `noindex, nofollow`, excluded from sitemaps and llms.txt, no public links, security headers, rate limits on sign-in.
- pt-BR UI copy from the mockups via the message catalog; dates and money with the existing formatters; money in integer cents.

## Tests
- API: permission matrix (each role × each action), staff sign-in only for allowlisted e-mails, audit entries for every mutating or revealing action, masked fields in list responses, CSV export permission and audit, assignment rules for owner requests, moderation checks as pure functions.
- Web: stories for every screen state (loading, empty "liga depois", error, data), keyboard navigation in queues, focus management in the detail panels.
- Playwright: staff signs in → verifies a CRECI → assigns an owner request → reveals a phone (audited) → sees the actions in the audit log.

## Process
1. Reply with a plan: hosting decision, staff auth design and migration away from the admin token, data available per screen (real / empty state), new tables and migrations, and conflicts with CLAUDE.md. Wait for my "go".
2. Small commits in the order above. Run `make check` and report what passed.
```

---

## Before pasting
- The mockups are in `docs/mockups/backoffice/`. Commit them with this prompt.
- Decide which staff e-mails get access first (Admin role) and set them in the allowlist setting Claude Code will add.
- Revenue and moderation light up only after billing (Stripe) and the listings table exist.
