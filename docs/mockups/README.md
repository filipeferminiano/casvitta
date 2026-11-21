# Mockups — approved screens

Approved designs from the Casvitta design canvas, exported for implementation. Each screen has a `.png` (what it should look like) and an `.html` (exact markup, inline styles and copy). Copy (pt-BR), numbers and names are demo data (`is_demo=true`).

How to use them:
- Match layout, hierarchy, spacing, states and pt-BR copy. Rebuild with `packages/ui` components and design tokens; never paste the inline styles or hex values into the app.
- The HTML is a static reference: no logic, no data fetching. Data comes from the API.
- If a mockup conflicts with CLAUDE.md or DESIGN_SYSTEM.md, the docs win; flag the conflict.
- Desktop screens were drawn at 1440 px (canvas boards at 1280–1600 px), mobile at 390 × 844.

## Design system & brand

| File | Screen | Viewport |
|---|---|---|
| `00-design-system-foundations` | 03 · Fundamentos do design system | desktop 1440px |
| `01-design-system-components` | 03 · Componentes do design system | desktop 1440px |
| `02-logo` | Logo Casvitta · opção 1 | desktop 1280px |
| `03-ecosystem-map` | 01 · Mapa do ecossistema | desktop 1600px |
| `04-information-architecture-module-store` | 02 · Arquitetura e loja de módulos | desktop 1600px |

## Door 1 — Ads Studio & marketplace (desktop)

| File | Screen | Viewport |
|---|---|---|
| `10-ads-studio-1-select-property` | P1 · Selecionar imóvel | desktop 1440px |
| `11-ads-studio-2-ai-ad` | P1 · Anúncio gerado por IA | desktop 1440px |
| `12-ads-studio-3-publish` | P1 · Publicar anúncio | desktop 1440px |
| `13-marketplace-property-detail` | P1 · Anúncio no marketplace | desktop 1440px |
| `14-ads-studio-lead-received` | P1 · Lead recebido | desktop 1440px |
| `15-whatsapp-qualification` | P1 · Qualificação no WhatsApp | desktop 1440px |
| `16-visit-booked` | P1 · Visita agendada | desktop 1440px |
| `17-weekly-report` | P1 · Relatório semanal | desktop 1440px |

## Door 1 — mobile (broker M1–M4, buyer M5–M7)

| File | Screen | Viewport |
|---|---|---|
| `20-mobile-broker-publish` | P1 mobile · Publicar | mobile 390px |
| `21-mobile-broker-new-lead` | P1 mobile · Lead novo | mobile 390px |
| `22-mobile-broker-conversation` | P1 mobile · Conversa | mobile 390px |
| `23-mobile-broker-report` | P1 mobile · Relatório | mobile 390px |
| `24-mobile-buyer-listing` | P1 mobile · Anúncio (comprador) | mobile 390px |
| `25-mobile-buyer-chat` | P1 mobile · Conversa (comprador) | mobile 390px |
| `26-mobile-buyer-visit-confirmed` | P1 mobile · Visita confirmada | mobile 390px |

## Door 2 — Broker OS

| File | Screen | Viewport |
|---|---|---|
| `30-broker-os-dashboard` | P2 · Dashboard | desktop 1440px |
| `31-broker-os-crm-kanban` | P2 · CRM Kanban | desktop 1440px |
| `32-broker-os-lead-detail` | P2 · Detalhe do lead | desktop 1440px |
| `33-broker-os-inbox-ai` | P2 · Inbox WhatsApp | desktop 1440px |
| `34-broker-os-calendar` | P2 · Agenda de visitas | desktop 1440px |
| `35-broker-os-proposals` | P2 · Propostas | desktop 1440px |
| `36-mobile-broker-inbox` | P2 mobile · Conversas | mobile 390px |
| `37-mobile-broker-calendar` | P2 mobile · Agenda | mobile 390px |

## Landing pages & social (from the sales deck)

| File | Screen | Viewport |
|---|---|---|
| `40-landing-property-page` | Apresentação · slide 5 | desktop 1280px |
| `41-landing-broker-page` | Apresentação · slide 6 | desktop 1280px |
| `42-social-media-calendar` | Apresentação · slide 4 | desktop 1280px |

## Public site journeys (casvitta.com.br)

`50-journey-map` shows the 8 entry paths and where each one lands in the product. Links between these HTML files work, so you can click through the journeys locally.

| File | Screen | Viewport |
|---|---|---|
| `50-journey-map` | Jornada casvitta.com.br | desktop 1840px |
| `51-home-desktop` | J1 · Home casvitta.com.br | desktop 1440px |
| `52-home-mobile` | J2 · Home mobile | mobile 390px |
| `53-search-results` | J3 · Resultados da busca | desktop 1440px |
| `54-for-brokers-and-agencies` | J4 · Para corretores e imobiliárias | desktop 1440px |
| `55-broker-signup-creci` | J5 · Cadastro do corretor | desktop 1440px |
| `56-owner-listing-request` | J6 · Anunciar meu imóvel (proprietário) | desktop 1440px |
| `57-developers-waitlist` | J7 · Para incorporadoras (em breve) | desktop 1440px |
| `58-investors` | J8 · Investidores | desktop 1440px |
| `59-auction-landing-desktop` | J9 · Leilão (captura) | desktop 1440px |
| `60-auction-landing-mobile` | J10 · Leilão mobile | mobile 390px |
| `61-auction-confirmation-mobile` | J11 · Leilão confirmação | mobile 390px |

## Programmatic SEO pages

See `docs/mockups/seo/README.md`: one folder per page type (valuation, ITBI calculator, building, neighborhood price + index, financing, street, listings), each with desktop, mobile and a states-components board. Build prompt: `docs/prompts/PROMPT_SEO_PAGES_BUILD.md`.

## Audience landing pages

See `docs/mockups/landing-pages/README.md` (owners, brokers, agencies; desktop + mobile). Build prompt: `docs/prompts/PROMPT_LANDING_PAGES_BUILD.md`.

## Backoffice

See `docs/mockups/backoffice/README.md` (routines map + BO1–BO8). Build prompt: `docs/prompts/PROMPT_BACKOFFICE_BUILD.md`.

## Casvitta Social (link na bio)

See `docs/mockups/social/README.md`. Build prompt: `docs/prompts/PROMPT_SOCIAL_BUILD.md`.

## Destaques (Casvitta Ads) and AdOps

See `docs/mockups/destaques/README.md`. Build prompt: `docs/prompts/PROMPT_DESTAQUES_BUILD.md`.

## CRM, automations, agents and broker success

See `docs/mockups/crm/README.md` (CRM, automations, conversational agents, saved-search alerts, QR signs, owner reports, network message tests) and `docs/mockups/backoffice/README.md` (09–16). Replaces mockups 31–33. Build prompt: `docs/prompts/PROMPT_CRM_BUILD.md`.
