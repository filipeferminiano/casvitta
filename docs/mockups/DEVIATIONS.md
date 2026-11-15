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
