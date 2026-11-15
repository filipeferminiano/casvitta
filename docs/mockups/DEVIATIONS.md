# Where the implementation deliberately differs from the mockups

The mockups are the visual target; CLAUDE.md and DESIGN_SYSTEM.md win on conflicts. Decided:

| Mockup | Implementation | Why |
|---|---|---|
| "Ads Studio" as a label (nav, cards, titles, "Ativar Ads Studio") | "Anúncios" everywhere in the UI and in URLs (`/anuncios/...`) | "Ads Studio" is an internal name only |
| Budget presets R$ 15 / 25 / 40 | Suggestions R$ 20 / 30 (recomendado) / 50 plus a free amount, minimum R$ 20/day; max spend follows (R$ 30 × 14 dias = R$ 420) | Minimum daily budget is R$ 20, chosen freely by the client |
| Times as `14:03` | `14h03` (and `14h` on the hour) | Time format rule, chat included |
| Dashboard at `/app`, store at `/app/loja`, landing at `/landing/...` | Dashboard at `/inicio`, store at `/modulos` on `app.` host; landing pages on `{slug}.` subdomains | Routes already established in Milestone 0 |
| Chat bubbles: lead dark on the right, AI/broker white on the left | Lead white on the left (radius 4/10/10/10); outgoing (AI or broker) `ink-900` on the right (radius 10/4/10/10) | DESIGN_SYSTEM §6 ChatThread |
| "Sugestão" badge on AI suggestions (lead detail) | "Feito por IA" badge | Every AI-generated text carries "Feito por IA" (CLAUDE.md §4.3) |
| Buyer chat: first AI message has no self-introduction (25) | "Sou o assistente virtual da Ana Ribeiro" in the first message | CLAUDE.md §4.3 |
| "Assistente com IA" badge on the Q&A box (13) | "Feito por IA" | CLAUDE.md §4.3 |
| "Ads Studio" in "O que vem no plano" (54) and the signup steps (55) | "Anúncios" | "Ads Studio" is an internal name only |
| Featured listings include the Perdizes apartment (51, 53) | Perdizes (Rua Cardoso de Almeida) is left out of the marketplace | It has no owner authorization; nothing is published without one (CLAUDE.md §4.2) |
| Investor example card without a broker (58) | Card shows the broker name and CRECI | Every published listing shows the responsible broker's CRECI (CLAUDE.md §4.1) |

## Known differences from Milestone 0.5 (mock data)

Screens are compared in `docs/mockups/_impl/` (`pnpm screens:capture`). These differences remain on purpose:

- **One demo clock.** The mockups are snapshots from different days (Door 1 shows 5–14/11, Door 2 shows 16/11). The data layer pins the clock to Monday 16/11/2026 10h13, so relative times are derived from it. Stored snapshots keep the mockup numbers (campaign "7 dias no ar", week-1 report). Consequences:
  - 14 · the new-lead alert shows the newest lead (Lucas F., há 8 min), not Marcos T.
  - 15 · Marcos is already past qualification, so the title reads "A IA está atendendo Marcos".
  - 21 · the phone lead page shows Marcos at his current stage (Proposta); the simulation uses his proposal (R$ 6.349), not the asking price (R$ 6.563).
  - 25 · the assistant offers the next free Saturday (21/11), not 14/11.
- **Derived counts.** 15 background leads (fictitious names, `is_demo`) fill the funnel to the mockups' 23 (6/5/5/4/1/2); one extra confirmed visit (Sat 21/11) makes "6 visitas, 4 confirmadas" true.
- **Inbox (33, 36).** Tabs filter for real and start on "Todas"; the list is sorted by "precisa de você", then most recent.
- **Agenda (16).** Thursday's visit shows the lead's name ("Vanessa C. · Casa Saúde").
- **Module store (04).** Only the store half is a screen; the information-architecture half is documentation.
- **Slides (40, 41, 42).** The sales-deck chrome is dropped; the page inside the browser frame is the route. The "[QR]" on 40 becomes an "Agende sua visita" button.
- **Photos.** Blueprint-grid placeholders stand in for property photos until storage exists.
- **Cross-host demo state.** The mock store lives in each host's sessionStorage, so a visit booked on `localhost` (buyer chat) does not show on `app.localhost`. The API in Milestone 1 removes this.

## Known differences from Milestone 0.6 (public site, 51–61)

Compared in `docs/mockups/_impl/51-*.png` … `61-*.png`.

- **Demo inventory.** Search results (53) and the home (51/52) also show listings from two fictitious brokers (Bruno Lima, CRECI-SP 111.111-F; Camila Prado, CRECI-SP 222.222-F), all `is_demo`. Ana's Broker OS data is unchanged.
- **Content width.** Public pages use the same container as the header (max 1280 px with 80 px side padding), so on a 1440 px screen the content is narrower than in the mockups and long titles wrap one line earlier (54, 56, 57, 58, 59).
- **Form placeholders (56, 57, 59).** The mockups show sample values ("04010-100", "Paulo Mendes", "R$ 700.000") with a "Dados de exemplo · demonstrativo" note. The forms start empty with format placeholders, so the note is dropped.
- **Agency OS and rental admin waitlists (54, 58).** "Quero ser avisado do Agency OS" and "Avise-me da administração de aluguel" open an inline form (name, WhatsApp, consent) instead of being a single click; signups need a phone and a consent (CLAUDE.md §4.8, §4.11).
- **Choice chips (58, 59, 60).** Selectable chips use the design-system ChoiceChips (rounded rectangles, 44 px targets) instead of the mockups' small pills.
- **Auction header on phones (60, 61).** The minimal header shows "Dúvidas? WhatsApp" (a link) instead of the "LEILÕES" label; the "Demonstrativo" badge on 61 sits above the check icon, not in the header, and only appears for `?demo=1` (real submissions show the visitor's own criteria).
- **Footer on auction pages (60, 61).** The full site footer is kept on phones (the mockups show a compact one), so the legal line and CRECI-J stay visible everywhere.
- **Not built here.** No consent banner: `track()` stays a no-op until analytics consent exists. `/favoritos`, `/minhas-visitas`, `/sobre`, `/privacidade` and `/termos` are placeholders.
