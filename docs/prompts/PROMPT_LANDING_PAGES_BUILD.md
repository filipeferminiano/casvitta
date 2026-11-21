# Prompt for Claude Code — audience landing pages (owners, brokers, agencies)

Paste the block below into Claude Code at the repo root.

---

```
Build the three audience landing pages from the approved mockups in docs/mockups/landing-pages/: owners (01-owners), independent brokers (02-brokers) and real-estate agencies (03-agencies), each with desktop (1440) and mobile (390) PNG + HTML, plus 00-prices-hypotheses. Read CLAUDE.md, docs/DESIGN_SYSTEM.md and docs/mockups/README.md first. Rebuild with packages/ui components and tokens; never paste the mockups' inline styles or hex values. If a mockup conflicts with CLAUDE.md, the docs win; flag it.

## Routes and what each page sells
| Page | Route | Offer | Primary CTA → destination |
|---|---|---|---|
| Owners | /anunciar-imovel (replaces the current owner page; see "Decisions") | One-off listing, no software: 1 property for 30 or 90 days | "Anunciar meu imóvel": start form (finalidade, tipo de imóvel, cidade) |
| Brokers | /para-corretores (replaces the current page) | Software subscription, portal publishing included up to the plan limit | "Conhecer o plano" (anchor) and "Começar com a Casvitta" → /cadastro/conta |
| Agencies | /para-imobiliarias (new) | Software for teams, 3 plans, optional assisted migration | "Agendar demonstração" → demo form on the page |

The header links "Para proprietários", "Para corretores" and "Para imobiliárias" switch between the three pages (desktop: nav items with aria-current; mobile: a 3-tab row under the header, as in the mockups). Use the site's existing MarketplaceNav and SiteFooter as the base: add the audience switch only on these three pages; the global header is being redesigned separately, so keep the change isolated in one component.

## Offers come from config (hypotheses, not final prices)
- Add one offer catalog in apps/web/src/config/site.ts (and the API settings, if the API needs it), env-overridable like PLANS today:
  - owner listing: 30 days R$ 59, 90 days R$ 149 (1 property, single payment, ends at the end of the period, renewal only by the owner's choice);
  - broker plan: R$ 99/month, 1 user, up to 50 active properties;
  - agency plans: Essencial R$ 299/month (200 properties, 5 users), Equipe R$ 499/month (500, 15), Operação maior "Sob consulta";
  - highlight (destaque): price not defined, never rendered as a number until set;
  - assisted migration: "orçamento separado".
- The current PLANS (Essencial R$ 197 / 3 properties, Profissional R$ 397 / 15) are used by the slides, the comparison screen (54), llms.txt and the backoffice mockups. Do NOT silently replace them: in your plan, list every place that reads PLANS and propose how the new catalog replaces it. I will confirm which price table is live.
- Never present prices as a promotion, a discount or market research. No "Teste grátis" (no trial is defined).

## Copy and content rules
- All pt-BR copy from the mockups, through the message catalog. Keep the FAQ answers exactly as the mockups say (they define product rules: active-property limit excludes sold/rented/paused properties; cancelling ends software access and plan-linked publishing at the end of the paid period; nothing is renewed without the owner's choice).
- Three visual tags, used consistently on all three pages: "Software de gestão" (blue-50), "Publicação no portal" (outlined ink) and "Destaque · opcional" (yellow-400). Publishing included in a plan never means a better position in search, nor Google/Meta campaigns.
- Do not invent audience numbers, testimonials, clients, results or certifications. Do not promise sale, rental or a number of contacts.
- Do not show WhatsApp automations, external integrations, AI features or Ads Studio on these pages (the brief for these pages excludes them).
- Product UI previews are illustrative static components (role="img" with an aria-label saying "Exemplo ilustrativo"), built from packages/ui pieces with the demo names from the mockups. They are not live data.
- Photos: the mockups use PhotoPlaceholder. Leave PhotoPlaceholder until I add real photos of Brazilian properties to apps/web/public/images/landing/; no stock photos from the web.

## Forms
- Owners start form (finalidade Vender/Alugar, tipo de imóvel, cidade): there is no payment yet (Stripe is not wired). Submitting creates an `interest_signups` row with a new kind `owner_listing_start` (consent per CLAUDE.md) and shows a confirmation: "Recebemos. Vamos te chamar no WhatsApp para concluir o anúncio." No price is charged and no listing is published from this form. Keep the existing owner → broker request flow reachable as a secondary link "Prefiro a ajuda de um corretor" (it feeds BO3 in the backoffice).
- Agencies demo form: nome, imobiliária, WhatsApp, e-mail, tamanho da equipe (1–5 / 6–15 / 16+), faixa de imóveis ativos; consent unchecked and required. Writes `interest_signups` with kind `agency_demo` (reuse AgencyInterest if it fits) and shows a success state.
- Brokers: CTA goes to the existing sign-up (/cadastro/conta), carrying `?plano=corretor`.

## SEO / GEO
- Titles and descriptions: owners "Anunciar imóvel sem mensalidade: 30 ou 90 dias | Casvitta"; brokers "Software para corretor de imóveis com portal incluído | Casvitta"; agencies "Sistema para imobiliárias com portal incluído | Casvitta". Canonical to self.
- Structured data: Organization (existing), BreadcrumbList, FAQPage only with the FAQ that is on the page, Offer/Product for each priced offer read from config (omit "Sob consulta" and the highlight).
- Add the three pages to the sitemap and to llms.txt (one line each: who it is for, what it includes, price from config).

## Tests
- Components: stories for the three tags, price cards (owner packs, broker plan, agency table/cards), FAQ, audience switch.
- Prices render only from config (a test changes the config and checks the pages).
- Forms: validation, consent required, success states, interest kinds written.
- Playwright at 390 and 1440: navigate owners → brokers → agencies through the audience switch; submit the owner start form; submit the agency demo form. Save screenshots next to the mockups in docs/mockups/_impl/landing-pages/ and compare them by eye.

## Decisions to confirm in your plan (wait for my "go")
1. Route for owners: /anunciar-imovel becomes this landing page (default), and the broker-matching request moves to a secondary link. Say what happens to existing links and analytics events.
2. The price catalog replacing PLANS (list of every consumer).
3. CLAUDE.md says every listing shows a CRECI. The owner page shows an owner's own listing with the badge "Anúncio do proprietário" and no CRECI. Propose the exact rule change for CLAUDE.md (owner self-listing allowed, no intermediation, no CRECI shown) and do not ship owner listings to the marketplace until I approve it.
```

---

## Before pasting
- The mockups are in `docs/mockups/landing-pages/`. Commit them with this prompt.
- Decide the live price table (new hypotheses vs. the current Essencial R$ 197 / Profissional R$ 397) and the CRECI rule for owner listings; Claude Code will ask in its plan.
- Real photos: put them in `apps/web/public/images/landing/` when you have them.
