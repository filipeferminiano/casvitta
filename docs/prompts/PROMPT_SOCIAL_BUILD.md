# Prompt for Claude Code — Casvitta Social (link in bio), milestone SOC-1

Paste the block below into Claude Code at the repo root.

---

```
Build Casvitta Social, milestone SOC-1: the free "Bio" plan and the paid "Social" plan of a broker link-in-bio product, plus custom domains and the backoffice screens it needs. The approved mockups are in docs/mockups/social/ (PNG + HTML; see its README). Read CLAUDE.md, docs/DESIGN_SYSTEM.md, docs/mockups/README.md and docs/mockups/social/README.md first. Rebuild with packages/ui components and tokens; never paste inline styles. If a mockup conflicts with CLAUDE.md, CLAUDE.md wins; flag it.

## Product in one paragraph
"Seu link na bio, seus imóveis e suas oportunidades em um só lugar." A broker publishes a free professional page in minutes (photo, CRECI, area, WhatsApp, up to 10 properties, QR code), puts the link in the Instagram/TikTok bio, and upgrades when needed. It is our entry product for brokers: their authorized properties can also appear on the Casvitta portal and be promoted with Destaques. Plans (hypotheses, from config): Bio grátis · Social R$ 49/mês · Automação R$ 149/mês · Imobiliária a partir de R$ 499/mês. Never promise audience, leads or sales.

## Scope of SOC-1
In: public storefront and property page, collections, "Encontre um imóvel para mim", owner acquisition form, onboarding to first publication, workspace (Visão geral, Minha página with editor and Endereço, Imóveis, Coleções, Interessados, Resultados, Plano e uso, Configurações), custom domains, plans page with the themed comparison, entitlements and feature gates for all four plans, backoffice BS1/BS2 and the listed adjustments.
Out (SOC-2, not designed yet): Instagram connection, comment-to-DM campaigns, inbox and human handoff, visit requests, active-contact packs, agency team/routing screens. Model entitlements for them now (gates show "available in Automação/Imobiliária") but build no Instagram integration. No WhatsApp automation in any plan.

## What already exists (build on it)
- `{slug}.casvitta.com.br` already routes to the (landing) group (`apps/web/src/lib/hosts.ts`, `/l/[brokerSlug]` and `/l/[brokerSlug]/[propertySlug]`, BrokerLanding/PropertyLanding) on demo data. Evolve these into the storefront (01) and property page (02). The default page address is `{slug}.casvitta.com.br` (mockups were corrected to this).
- Email-link sign-in, workspaces, memberships and roles; CRECI verification queue (BO2); backoffice host with staff roles, permissions and audit; offer catalog in config; LeadAlertForm; interest/alerts domains.
- Missing: a listings table (the marketplace runs on fixtures) and billing (no Stripe).

## 1. Data model (propose in your plan, then migrate)
- `broker_pages` (workspace, slug unique and stable with redirects, template, theme, sections order/visibility, published_at, status published/unpublished/suspended, custom_domain_id).
- Properties: SOC-1 needs real properties. Propose the minimal `listings` domain shared with the marketplace (CLAUDE.md §4.1/4.2): owner authorization (document or signed attestation, expiry), publication channels (bio page, portal), status active/draft/unavailable, code (e.g. CV-204), price and recurring costs with "Não informado" when missing (never invent fees), neighborhood-level public location, source (Casvitta inventory vs manual), last sync status. If you think listings should be its own milestone first, say so in the plan.
- `collections` (manual, ordered; "Vi no Instagram" = manually mapped post URL → property; no automatic social sync).
- `page_inquiries` with kind buyer_tenant | owner, preferences, source (campaign link/UTM, QR, bio, direct), status (Novo, Em atendimento, Concluído, Sem interesse; visit statuses only exist in SOC-2), notes, next action, responsible, history. Contact data only as provided; never infer a phone from a social identity. Consent required and stored.
- `page_events`: page_view, property_view, whatsapp_click (never "message sent"), form_submitted, with source. Deduplicate bots.
- `custom_domains` (hostname, page or agency, verification token, status pending/verifying/active/error/detached, last_check, cert status).
- `plan_entitlements`: one config-driven matrix (see §5) consumed by API and web.

## 2. Public experience (mockups 01–03)
- Mobile-first storefront: identity, CRECI line, area, value proposition, one primary WhatsApp action, Comprar/Alugar/Anunciar, "Vi no Instagram", featured properties, collections, finder CTA, owner CTA, about, optional testimonials (always labeled when they are examples; no verification badge except "CRECI conferido pela Casvitta", which links to what was checked). No registration to browse. Free pages show only the discreet footer "Crie sua página com a Casvitta"; no pricing banners to property seekers.
- CRECI gate: the page can publish immediately, but properties and the CRECI-verified line appear only after BO2 verifies the CRECI. Until then the page shows profile + WhatsApp.
- Property page: gallery, price, recurring costs table (rent + condomínio + IPTU + total; utilities excluded), specs, description, amenities, neighborhood-level map, code, broker + agency + CRECI, "Falar sobre este imóvel" (WhatsApp with the prefilled message from the mockup), similar properties, availability. Unavailable property keeps the URL alive with alternatives (03).
- Finder (Social+): 5 short steps → matches → optional "Pedir ajuda da corretora" with contact + consent. No CPF or financial documents.
- Owner form (Social+): service, city, neighborhood, type, optional details, contact method; confirmation without promising a formal valuation.
- SEO: storefront and property pages are indexable on the broker's page host; JSON-LD (RealEstateAgent / Offer with the CRECI), canonical rules in §4.

## 3. Onboarding and workspace (mockups 10–13, 15)
- Onboarding in 9 steps exactly as 10-onboarding: account (existing email link) → corretor/imobiliária → professional data (CRECI required) → template → inventory (authorized Casvitta properties or manual with owner authorization) → mobile preview → publish (no plan choice before first publication) → QR code (PNG + print PDF) → how to add the link to Instagram/TikTok/WhatsApp. Then Visão geral with the setup checklist.
- Workspace is Casvitta product UI (Planta tokens). Public page themes ("Cambuí" deep green + terracotta, "Planta", "Terracota") are theme presets in packages/ui, not hardcoded colors.
- Minha página: tabs Conteúdo (sections on/off + order + fields), Aparência (template, colors within the plan), Endereço (slug + custom domain), Compartilhar; live mobile preview; draft vs published with an unsaved/unpublished banner; publish/unpublish.
- Imóveis: list/cards, statuses, source, sync status and failure state (page keeps the last confirmed data), visibility toggle, link + QR per property, active-property allowance with the contextual upgrade at the 11th property (13).
- Interessados (Social+): list + detail (source, property, preferences, provided contacts, notes, responsible, next action, history), buyer/tenant separated from owner, CSV export. Accessible without the full CRM.
- Resultados: page visits, property views, WhatsApp clicks, forms by source; short attribution note (a click is not a lead; no deals inferred).
- Plano e uso: current plan, entitlements, usage meters, "check what your existing Casvitta subscription already includes", downgrade impact preview where the broker selects which properties stay active (nothing deleted), data export.

## 4. Custom domains (mockups 14, 15)
- Social and above (hypothesis in config). Flow and states exactly as 14-custom-domain-flow: enter www domain → TXT + CNAME instructions with copy buttons and a Registro.br guide → verifying (up to 48 h, e-mail when done) → specific error showing the value found → active (HTTPS auto-renew, `{slug}.casvitta.com.br` 301 → domain, old QR codes keep working, new QR download) → detached later (falls back to the subdomain, never offline). Agency: one domain with a path per broker (/mariana).
- hosts.ts gains a lookup for verified custom hostnames → page. Propose the certificate approach for many hostnames (e.g. Cloudflare for SaaS custom hostnames or Google Certificate Manager in front of Cloud Run) with cost and limits; daily DNS/cert check job.
- SEO default (I may change it): storefront canonical = custom domain; property pages canonical = the Casvitta portal listing when it exists, else self. Custom-domain pages are not in the Casvitta sitemap; each domain serves its own sitemap.xml and robots.txt.

## 5. Plans, entitlements and pricing page (mockups 20, 21)
- One entitlement matrix in config, used by API gates, web gates, the comparison page and llms.txt. Copy the six themes and every row from 20-plans-comparison-desktop, including "Domínio próprio" (— / ✓ / ✓ / Domínio da imobiliária), Bio 10 active properties, Social/Automação 50, Imobiliária "Sob consulta", contacts 300 / 2.000, pack 250 por R$ 49 (authorization required), 1/1/1/10 pages, 1/1/1/5 users.
- Public page /planos (or under /para-corretores; propose): sticky plan headers, left theme navigation that scroll-syncs, Social column emphasized with "Para crescer nas redes", expandable rows (WhatsApp com referência, Vi no Instagram, Domínio próprio, Comentário para mensagem privada, Distribuição de interessados) without nested accordions; mobile: theme chips + two plans side by side with plan selectors, no horizontal scroll. FAQ from the mockup. Publicly accessible.
- Billing is not wired. Upgrades in SOC-1: show the plan and price, then create an upgrade request handled by staff in the backoffice (plan assigned manually, audited) behind `SOCIAL_BILLING_ENABLED=false`. Design the checkout states so Stripe can drop in later. Never show trials, discounts or annual prices.
- Price table: three tables exist (code R$ 197/397, landing pages R$ 99/299/499, this one). In your plan, list every consumer of prices and propose one catalog; I will confirm.

## 6. Backoffice (mockups 30–32)
- New screens on the backoffice host: Páginas e domínios (31: reports, suspicious content, external links, reserved slugs, domain health; unpublish with mandatory reason, audited) and Contas e uso (32: funnel conta → página publicada → CRECI conferido → link usado → primeiro contato → plano pago, plans, accounts needing attention, new revenue lines).
- Adjust existing screens as listed in 30-backoffice-impact: BO1 cards; BO2 prioritization (published pages with properties first); BO3 rule: inquiries from broker pages belong to the broker; staff see totals only and opening a record requires a support request and is audited; BO4/BO5 plans, entitlements, domain; BO6 manual properties go to the portal only after the owner authorization check; BO7 revenue lines; BO8 new role "Suporte Social" without access to inquiry data.
- Reserved slugs list (casvitta, oficial, suporte, app, backoffice, …) and abuse reports from the public footer.

## 7. Rules (add tests)
- Every listing shown publicly has a valid owner authorization and the broker's verified CRECI (CLAUDE.md). Demo data (`is_demo`) never appears on real pages.
- Never invent fees; missing values render "Não informado". WhatsApp click ≠ message sent. A click is not a lead.
- LGPD: consent per purpose (unchecked, required), export and deletion on request, inquiry data access audited.
- All pt-BR copy in the message catalog; no implementation terms (DNS is the only technical term shown, where the provider requires it).

## Tests
- API: entitlements per plan (every row of the matrix), CRECI gate on properties, authorization gate, slug uniqueness/redirects/reserved, domain state machine and fallback, inquiry consent and source attribution, staff access rules, downgrade keeps records.
- Web: stories for every state in the mockups; storefront and property page at 390 and 1440; comparison page scroll-sync and mobile plan selector; accessibility (labels, focus, contrast).
- Playwright journeys: (1) new broker → onboarding → published page → copy link; (2) visitor → storefront → property → WhatsApp handoff; (3) visitor → finder → matches → inquiry; (4) owner form → appears in Interessados; (5) Bio broker at 10 properties → upgrade request → Social features unlocked by staff; (6) connect custom domain (mocked DNS) → active → subdomain redirects; (7) staff unpublishes a reported page with a reason → audit entry.

## Process
1. Reply with a plan: data model and migrations (including the listings decision), how the existing /l/[brokerSlug] evolves, entitlement matrix location, custom-domain hosting and certificates, price catalog consumers, and conflicts with CLAUDE.md. Wait for my "go".
2. Small commits: data model → public pages → onboarding → workspace → entitlements/plans page → custom domains → backoffice. Run `make check` and report.
```

---

## Before pasting
- Mockups: `docs/mockups/social/` (commit them with this prompt).
- Decide the single price table and whether custom domains start at Social.
- SEO default for property pages on custom domains: canonical to the Casvitta portal (change it in the plan review if you prefer the broker's domain).
- SOC-2 (Automação: Instagram, comment-to-DM, inbox; Imobiliária: team and routing) needs Meta approval for Instagram messaging and the round-2 designs.
