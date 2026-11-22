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

## Real accounts (app on the database, phase 1, Nov 2026)

- **Sign-up and sign-in by email link (55, /entrar).** The mockups ask for a phone number and a 6-digit SMS code. The account step now asks for name and email and sends a single-use link (15 minutes) through Resend's free tier; SMS needs a paid provider. The phone stays in the signup as the WhatsApp step. Demo mode shows "Abrir o link (demonstração)" instead of sending an email. Product decision, 20/11/2026.
- **Link confirmation page.** `/entrar/confirmar` has no mockup: it confirms the link from the URL fragment, then continues the signup (`/cadastro/creci`) or opens the app (`app.` host, via a one-time handoff code).
- **"Sair".** The side nav and Configurações gain a sign-out button (not in the mockups).

## Audience landing pages (landing-pages/01–03, Nov 2026)

Compared in `docs/mockups/_impl/landing-pages/` (`pnpm screens:capture landing-pages`).

- **"Demonstrativo" moves from the header to the pictures.** The mockups show the badge in the header to mark the whole board; the pages instead put it under every product picture and listing example ("Demonstrativo · Exemplo ilustrativo"), because those carry example numbers (DESIGN_SYSTEM §5). Each picture is one `role="img"` with an "Exemplo ilustrativo: …" label.
- **Owner start form has a second step.** The mockup form only asks finalidade, tipo and cidade; an interest signup needs a name, a WhatsApp and the contact consent (CLAUDE.md §4.8), so "Anunciar meu imóvel" opens a second step in the same card. Pack buttons ("Anunciar por 30/90 dias") open the same form with the period chosen. Nothing is charged or published; the confirmation says "Recebemos. Vamos te chamar no WhatsApp para concluir o anúncio." The broker-matching request (mockup 56) moved to `/anunciar-imovel/corretor`, linked as "Prefiro a ajuda de um corretor".
- **Forms start empty.** "São Paulo, SP" (owner city), "6–15" (team size) and the other sample values become placeholders or no selection, as on 56–59.
- **Header.** The mockups give these pages their own 3-link header (proprietários, corretores, imobiliárias). They keep the site header instead, like every other public page: its menus already reach all three (Vender › "Anunciar meu imóvel"; Para profissionais › "Planos para corretores", "Imobiliárias"). The footer is the existing `SiteFooter`, not the mockups' three-column footer.
- **Numbered steps.** Owners "Como funciona" and agencies "Migração" use the shared `NumberedSteps` ("1", "2", "3" in the display face) instead of "01" in mono; the brokers flow keeps "01–04" with its small pictures.
- **"Falar com a equipe" (Operação maior)** scrolls to the demo form instead of a separate contact path.
- **Replaced pages.** `/para-corretores` (mockup 54: AI ads, the R$ 1.497 comparison and the Agency OS waitlist) is replaced by the brokers page; its `_impl/54` screenshot is removed. The old Agency OS waitlist (`agency` signups) is gone; existing rows stay.

## Site link structure (Nov 2026)

Every public page type is reachable from the home within a fixed number of clicks (checked by `apps/web/e2e/site-links.spec.ts`): sections at 1 click, neighborhood pages at 2, street, building, valuation and financing pages at 3. Before this the market-data pages were reachable only through the sitemap.

- **Header (51–53).** Adds "Para imobiliárias"; "Começar como corretor" opens `/para-corretores` (plan first, then signup) instead of the signup.
- **Footer.** New column "Preços e ferramentas" (Preço do m² em São Paulo, Quanto vale meu imóvel, Calculadora de ITBI, Simular financiamento); "Anunciar com um corretor" under "Para você". The simulator link moved from "Para você" to the new column.
- **Home (51, 52).** A "Preços e ferramentas" link row under the financing simulator; not in the mockups.
- **Property page (13).** The breadcrumb is a real trail ("Comprar › São Paulo › Vila Mariana › Apartamento"): the neighborhood opens its listings page when one is published (else the search filtered by it), and rentals start with "Alugar".
- **Audience pages (landing-pages/01–03).** A visible "Início › page" breadcrumb above the hero; the owners form also links to "Quanto vale meu imóvel?".


## CRM, plan catalog and Destaques (Nov 2026)

- **One catalog (CRM-0).** Plans, limits, features, add-ons, Destaques and owner packages live in `apps/api/app/core/catalog.py`; the web reads the generated `packages/config/catalog.json`. It replaces the R$ 197/397 code plans, the R$ 99/299/499 landing offer and the Bio/Social ladder of `PROMPT_SOCIAL_BUILD` §5 (free plan: 5 active properties, not 10; custom domain from Automação, not Social).
- **Annual prices hidden (00-prices-hypotheses, 02-brokers).** The mockups show "Anual · 2 meses grátis". CLAUDE.md forbids presenting a price as a discount, so the annual per-month prices are in the catalog but not rendered until the owner confirms (`SHOW_ANNUAL_PRICES=false`).
- **No self-service plan change.** Billing is not wired: signup and upgrades create a plan request; the Casvitta team assigns the plan in the backoffice (Contas → "Pedidos de plano e pacotes"), audited. Every account starts on Grátis.
- **"WhatsApp oficial conectado" (00-prices-hypotheses).** WhatsApp is connected by the Casvitta team through Evolution API (product decision, 21/11/2026), not the official Cloud API and not self-service: the row reads "WhatsApp conectado pela equipe Casvitta". The note "Responder um cliente dentro de 24 horas não é cobrado" is out of date for the official API too (Meta charges service and utility messages in the window since 01/10/2026) and is not shown.
- **Pipeline stages are configurable** (CRM 03), with Novo → Em conversa → Visita marcada → Proposta → Fechado / Perdido as defaults; CLAUDE.md §5 listed a fixed `leads.stage` enum.
- **"5 photos" to publish (CRM 04)** is a configurable gate on top of CLAUDE.md rules 1–2.
- **Destaques seal.** "Destaque pago" → "Patrocinado"; it appears only in search slots (max 2 per page), never on the home, property page or broker page, and never from an Anúncios (Meta/Google) campaign.

## Brokers page and prices page (landing-pages/02-brokers and 00-prices-hypotheses, CRM release, Nov 2026)

Compared in `docs/mockups/_impl/landing-pages/` (`pnpm screens:capture landing-pages`). Every price, limit, add-on and package comes from the plan catalog; `prices.test.tsx` renders the pages with a catalog where every value differs from the real one.

- **Prices page at `/precos`.** Linked from the brokers and agencies pages, "Para profissionais › Preços e limites dos planos", the footer, the site map, the sitemap and llms.txt. No mobile mockup: on phones the table becomes one card per plan, grouped by section. "Alertas de busca salva" (a catalog feature) is an extra row under "Assistente de IA".
- **WhatsApp copy.** Besides the table row (see "CRM, plan catalog and Destaques"), the extras box says "A conexão é feita pela equipe Casvitta; não há cobrança por mensagem da Meta" and the FAQ "Quanto custa o WhatsApp?" says the connection is done by the team, from the first plan that includes it, with no Meta charge per message. The automations picture says "WhatsApp · na véspera, às 18h" instead of "modelo aprovado".
- **No "para sempre".** The Grátis card reads "sem cartão de crédito"; the hero line is "Plano Grátis com 5 imóveis · sem cartão de crédito · planos pagos a partir de R$ 49/mês" and the FAQ answer drops "sem prazo".
- **Paid plans are requests.** "Escolher {plano}" opens `/cadastro/conta?plano={key}`; a line under the cards says the team confirms within 1 business day and nothing is charged before. "Falar com a gente" (Imobiliária) opens the agencies demo form.
- **Pro card.** The mockup lists "Segmentos e relatórios por origem" under Pro; the catalog has segments from Automação, so the Pro card says "Relatórios por origem".
- **Demo persona.** The pictures use Ana Ribeiro (CLAUDE.md §6) instead of Mariana Alves; listing examples are the Vila Mariana and Pinheiros ones of the other audience pages.
- **Header** as on the other audience pages: the site header, not the mockup's 3-link header.
- **Agencies page (03).** The Essencial / Equipe / Operação maior table is replaced by one Imobiliária card from the catalog (from R$ 499, users included + price per extra user, active-property limit, what it adds to Pro), the extras box and a link to `/precos`. "Operação maior · sob consulta" becomes the line "Mais de 1.000 imóveis ou uma equipe maior? Fale com a gente na demonstração…". The FAQ "Como escolho o plano?" becomes "Como funciona o plano Imobiliária?".

## Casvitta Social, SOC-1a (onboarding and the broker page)

- **CRECI gate on the page.** Mockup social/10 says the page publishes before the CRECI check. CLAUDE.md rule 1 wins: the broker can publish, but `{slug}.casvitta.com.br` opens to visitors only after staff verify the CRECI (`PAGE_REQUIRES_VERIFIED_CRECI=true`; set it to false to follow the mockup). Properties always need the verified CRECI and the staff-checked owner authorization.
- **No plan step in the signup** while the `social` area is live: account → CRECI → WhatsApp → the page onboarding in the app (steps 2–9 of social/10). A `?plano=` link still records a plan request.
- **Free plan line** reads the catalog ("até 5 imóveis ativos"), not "até 10".
- **Not in SOC-1a:** Vi no Instagram, Seleções, the finder, the owner form (the owner call to action opens WhatsApp), testimonials, slug change with redirects, custom domains, Interessados, backoffice Páginas e domínios. The print PDF is the QR code alone.
