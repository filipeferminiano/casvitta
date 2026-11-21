# Mockups — CRM, automations and conversational agents (Broker OS)

Approved designs from the Casvitta design canvas (page "CRM"), as `.png` and `.html`. Desktop 1440 px, maps and scenario boards 1840 px, mobile 390 px. Same rules as `docs/mockups/README.md`: rebuild with `packages/ui` and tokens, the HTML is a static reference, `CLAUDE.md` wins on conflicts. Names and numbers are demo data; the yellow "Demonstrativo" badge marks mockups only.

These screens replace the old Broker OS CRM mockups 31–33 (`31-broker-os-crm-kanban`, `32-broker-os-lead-detail`, `33-broker-os-inbox-ai`). Menu: Atendimento (Início, Caixa de entrada, Contatos, Funil, Agenda) · Imóveis (Imóveis, Minha página) · Crescimento (Automações, Segmentos, Modelos de mensagem, Destaques, Anúncios) · Conta (Relatórios, Plano, uso e canais).

| File | Screen |
|---|---|
| `00-map-decisions` | CR0 · Flow from property to result, decisions and rules |
| `01-contacts` | CR1 · Contatos (list, consent per channel, source) |
| `02-contact-360` | CR2 · Contato 360 (timeline, interests, consent, next steps) |
| `03-pipeline` | CR3 · Funil |
| `04-property-create` | CR4 · Cadastrar imóvel → page on the Casvitta site (gates: CRECI, owner authorization, 5 photos) |
| `05-property-published` | CR5 · Publicado: where it appears, matching contacts, first days |
| `10-automations-hub` | AU1 · Automações (list, usage, templates) |
| `11-whatsapp-journey-builder` | AU2 · Journey builder (trigger, rule, condition, wait, message, hand off, end; 10% control) |
| `12-instagram-comment-to-dm` | AU3 · "Comente CAMBUÍ" Instagram flow and limit states |
| `13-message-templates` | AU4 · Modelos de mensagem (Meta approval states) |
| `14-segments` | AU5 · Segmentos |
| `15-inbox` | AU6 · Caixa de entrada (bot/human, take over) |
| `16-reports` | AU7 · Relatórios (observed vs incremental) |
| `17-plan-usage-channels` | AU8 · Plano, uso e canais (limits of the Automação plan, Meta billing) |
| `18-mobile-inbox`, `19-mobile-conversation` | Mobile inbox and taken-over conversation |
| `20-agents-list` | AG1 · Agentes (list and templates) |
| `21-agent-goal-tone-limits` | AG2 · Objective, tone, knowledge, fixed "never does" rules |
| `22-agent-actions-handoff` | AG3 · Tools with Faz sozinho / Pede sua aprovação / Desligada + hand-off rules |
| `23-visit-calendar` | AG4 · Agenda de visitas (free slots, rules, Google free/busy only) |
| `24-agent-test` | AG5 · Test with scenarios and the tool-call trace |
| `25-agent-conversation-review` | AG6 · Review conversations, flag a wrong answer, turn it into a correction |
| `26-agent-scenarios` | AG7 · 9 scenarios: confirmation, reschedule, slot taken, unknown answer, discount, approval, calendar failure, human requested, after hours |
| `30-notify-matching-contacts` | PS1 · New property → notify contacts whose saved search matches |
| `31-saved-searches` | PS2 · Buscas salvas and alert rules |
| `32-saved-search-contact-flow` | PS3 · What the contact sees (opt-in, confirmation, alert, still looking?, SAIR) |
| `33-qr-signs` | PS4 · Placas com QR (stats per sign + sign generator) |
| `34-qr-sign-contact-flow` | PS5 · QR scan → prefilled WhatsApp → auto reply → visit + consent; sold property |
| `35-property-performance-objections` | PS6 · Property funnel + objections summarized from conversations |
| `36-owner-report-mobile` | PS7 · Monthly report the owner receives (no personal data) |
| `37-network-message-tests` | PS8 · Message variants tested across the broker network |
| `40-home-next-steps` | BM6 · Início: "Primeiros passos" checklist and suggested next step |

Backoffice screens for this module are in `docs/mockups/backoffice/` (09–16). Plans and prices: `docs/mockups/landing-pages/00-prices-hypotheses`.

Build prompt: `docs/prompts/PROMPT_CRM_BUILD.md`.
