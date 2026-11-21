# Prompt for Claude Code — Milestone SEO-3: build the designed SEO pages (São Paulo)

Paste the block below into Claude Code at the repo root. It builds on what is already merged from SEO-1 (ITBI pipeline, `market_data`/`alerts`/`seo` domains, the `/preco-m2`, `/condominio` and `/financiamento` routes, `Breadcrumbs`, `Tooltip`, `MonthlySeriesChart`, `SourceNote`, `LeadAlertForm`). SEO-2 (IPTU register, street stock, listing gates) has not run yet; this prompt says which parts wait for it.

---

```
Milestone SEO-3: implement the approved designs for the programmatic SEO pages. The mockups are in docs/mockups/seo/ (one folder per page type: desktop 1440, mobile 390, and a states-components board). Read CLAUDE.md, docs/DESIGN_SYSTEM.md, docs/mockups/seo/README.md, docs/PROMPT_DESIGN_SEO_PAGES.md (the design brief, with the target searches per page) and docs/PROMPT_SEO_STREET_PAGES.md first. CLAUDE.md and the privacy rules win over any mockup; flag conflicts in your plan.

## Why
Each page type targets searches people actually type (keyword map below). SEO-1 shipped the data and first versions of the price, building and financing pages. This milestone makes them match the designs, adds the two tools with the highest search demand (valuation and ITBI calculator), moves street pages to their own URL, and prepares the sale/rental listing templates so they light up when authorized listings exist.

## Keyword map (titles, H1 and URLs come from this table)
Titles and H1 are templates filled with data from the API; never hardcode numbers. Meta descriptions repeat the lead sentence (the 1–2 sentences with the key numbers, which is what Google quotes).

| # | Page | URL | Target searches | <title> | H1 |
|---|---|---|---|---|---|
| 1 | Valuation | /quanto-vale-meu-imovel and /quanto-vale-meu-imovel/[cidade]/[bairro] | quanto vale meu apartamento; quanto vale meu imóvel; avaliação de imóvel grátis; quanto vale meu apartamento na [bairro] | Quanto vale meu apartamento na [Bairro]? Avaliação grátis com vendas reais | Quanto vale seu apartamento na [Bairro]? (city: Quanto vale seu imóvel em São Paulo?) |
| 2 | ITBI calculator | /itbi/[cidade] | calcular ITBI São Paulo; ITBI SP valor; quanto é o ITBI em São Paulo; valor venal de referência; ITBI financiamento SFH | Calcular ITBI em São Paulo [ano]: simulador e regras | Calcule o ITBI do seu imóvel em São Paulo |
| 3 | Building | /condominio/[cidade]/[bairro]/[predio] | edifício [nome]; condomínio [nome] [rua]; [nome] [bairro]; apartamento edifício [nome]; [rua] [número] | [Nome do prédio], [Rua], [número] – [Bairro]: vendas e apartamentos | Edifício [Nome] · [Rua], [número] — [Bairro] (no name: Edifício na [Rua], [número] — [Bairro]) |
| 4 | Neighborhood price | /preco-m2/[cidade]/[bairro] | preço m² [bairro]; valor do metro quadrado [bairro]; quanto custa um apartamento na [bairro]; preço apartamento [bairro] [ano] | Preço do m² na [Bairro]: R$ X (vendas reais de [ano]) | same as title |
| 4b | City index | /preco-m2/[cidade] | preço do m² em São Paulo por bairro | Preço do m² em São Paulo por bairro ([ano], vendas reais) | Preço do m² em São Paulo por bairro |
| 5 | Financing | /financiamento/[cidade]/[bairro] | quanto preciso ganhar para financiar um apartamento; renda para financiar imóvel de [valor]; simulação financiamento [bairro] | Quanto preciso ganhar para comprar na [Bairro]? Simulação | Quanto você precisa ganhar para comprar na [Bairro] |
| 6 | Street | /rua/[cidade]/[bairro]/[rua]; parent /rua/[cidade]/[rua] | [rua] [bairro]; morar na [rua]; prédios na [rua]; apartamentos [rua] | [Rua], [Bairro]: prédios, imóveis e vendas reais | [Rua], [Bairro] |
| 7 | Listings | /imoveis/aluguel/[cidade]/[bairro][/rua] and /imoveis/venda/… | apartamento para alugar [bairro]; aluguel [bairro]; apartamento à venda [bairro]; apartamento para alugar [rua]; apartamento 2 quartos [bairro] | Apartamentos para alugar na [Bairro\|Rua X] ([n] anúncios) | Apartamentos para alugar na [Bairro\|Rua X] + count chip |

Street pages do not target "preço m² rua X" (nobody searches it): their title and H1 carry only the street name.

## Rules that apply to every page (from the design brief; add tests)
- Breadcrumb (São Paulo › Bairro › Rua › Prédio as applicable) with BreadcrumbList; one H1 built from data; a lead paragraph with the key numbers; H2s phrased as the real questions shown in the mockups; an internal-links block; the source line from SourceNote: "Fonte: Prefeitura de São Paulo — guias de ITBI · Atualizado em dd/MM/yyyy".
- Every R$/m² is labeled "R$/m² de área construída (IPTU)" and has the Tooltip explaining that it includes common areas and is therefore lower than listing prices per m².
- Prices only for groups of ≥ 10 sales. The mockups show a count with "poucas vendas registradas" below that. Today `gates.MIN_GROUP` is 5 and the building gate allows fewer sales: add a setting `MARKET_MIN_PRICE_GROUP=10` that applies to every published median (neighborhood, street, building, area bands, comparable groups, monthly points) and keep the existing page gates for counts/indexability. In your plan, report how many pages and blocks change because of this.
- Never a single sale, an exact sale date, a unit number, SQL, matrícula or owner data.
- Listings only from our own authorized marketplace listings with a validated CRECI shown on the card (CLAUDE.md §4.1/§4.2). No listing yet → EmptyState + LeadAlertForm. Never placeholder or demo cards on these pages; demo data never appears when `is_demo` is false.
- Every financing number carries the Badge "Simulação · não é aprovação"; never "aprovado" or a promise of credit.
- The yellow "Demonstrativo" badge in the mockups appears in the app only when `SourceInfo.is_demo` is true.
- Use the site's existing header and footer, not the simplified ones in the mockups.
- No AI-written copy. All pt-BR copy goes through the message catalog, as template sentences filled with numbers.
- Mobile-first, server-rendered main numbers (no client fetch for the H1, lead and stat tiles); charts can hydrate.

## 1. Shared components (packages/ui, Storybook stories for every state in the states-components boards)
Reuse: StatTile, DataTable, PropertyCard, FinancingSimulation, Badge, Chip, Tabs, SegmentedControl, States (Empty/Loading/Error), Breadcrumbs, Tooltip, MonthlySeriesChart, SourceNote, CurrencyInput, LeadAlertForm.
New, as named in the callouts: AddressAutocomplete, ValueRangeResult (with confidence), ComparableGroupList, TaxCalculatorCard, BreakdownTable, BuildingFactsRow, SalesPerYearBars, OwnerCTA, BuildingList, AreaBandTable, NeighborComparisonTable, ZoneFilter, IncomeNeededResult, NeighborIncomeTable, StreetQuickLinks, StockBlock, TurnoverLine, BuildingTable, SegmentTable, FilterBar + FilterSheet, ResultsHeader, ListingDataStrip, ZeroResultsAlert, StickyResultBar (mobile pinned result on ITBI and financing). Extend MonthlySeriesChart with the optional monthly sales bars (two series) and PropertyCard with the rent + condomínio + IPTU + total lines.

LeadAlertForm (see 00-overview for its states):
- Intents become a prop: the list and the default vary by page (table below). Optional `chips` (the current filters on listing pages) and one optional extra field (budget on financing). Consent "Aceito ser contatado sobre imóveis" unchecked and required; privacy line; success "Pronto. Avisaremos pelo WhatsApp quando houver novidade."
- Backend: extend `AlertIntent` with `rent`, `own_sell`, `own_rent`, `own_valuation`, `researching` (keep `buy`; migrate `owner` → `own_sell`), and `AlertScope` with `city` and `street_segment` (SEO-2 will use the latter). Store `source_path`, and on valuation leads the estimate snapshot (range, confidence, inputs). Migration + tests.

| Page | Intents (default first) |
|---|---|
| Valuation | own_sell, own_rent, own_valuation |
| ITBI | buy, researching |
| Building (empty listings) | buy, rent |
| Neighborhood price | buy, rent, own_sell |
| Financing | buy (+ budget field) |
| Street | buy, rent, own_sell |
| Listings | rent or buy (pre-set by the page), the other one second |

## 2. Restyle the SEO-1 pages to match the mockups
- 04 Neighborhood price (`/preco-m2/[cidade]/[bairro]`): H1 with the number and year; 4 StatTiles including sales 12 m with change vs. the previous 12 m and R$/m² with its 12-month change (add `change_pct` fields to the API, computed only when both windows pass the gate); MonthlySeriesChart with R$/m² line (12-month moving median) + monthly sales bars; AreaBandTable with median R$/m² per band (add to `AreaBand`); top streets and top buildings side by side; NeighborComparisonTable with the current neighborhood highlighted; two CTA cards (financing, valuation) + LeadAlertForm; method note. States: full, below threshold (count + neighbors, noindex), loading, error (chart error must not break the page).
- 04b City index (`/preco-m2/[cidade]`): city StatTiles, search box, ZoneFilter (Todas / Centro / Sul / Oeste / Norte / Leste, from `neighborhoods.zone`), sortable table (default: R$/m² desc), "Mostrar mais bairros". Filtering and sorting work without JS through query params (`?zona=sul&ordem=preco`) that canonicalize to the clean URL.
- 03 Building (`/condominio/...`): BuildingFactsRow (year, floors, units, standard — show only fields we have; floors/units/standard come with SEO-2), static street-level map placeholder (no satellite photo), StatTiles, SalesPerYearBars (counts only), "Comparado ao bairro" bars (building vs. street vs. neighborhood R$/m², with the "X% acima/abaixo da mediana" sentence), units block (hidden until SEO-2 gives the register data), listings in the building or the empty state with alert, OwnerCTA (yellow-50) linking to the valuation tool with the address pre-filled, other buildings on the street (BuildingList), source. States: rich, few sales (count only), no listings, no name.
- 05 Financing (`/financiamento/...`): two columns (hero + context left, FinancingSimulation right on desktop). The lead sentence is computed from the page's own simulation (the brief's "~R$ 21 mil" was a placeholder: with 20% down, 360 months, SAC and 11,5% a.a., R$ 750 mil gives ~R$ 23.780). IncomeNeededResult (SAC shows first and last installment; Price shows the fixed one), financed share by year bars from ITBI, NeighborIncomeTable (neighbors' median price and indicated income, same assumptions), lead form with budget. States: default, edited, SAC/Price, down payment below minimum, mobile pinned result. All math from core/finance.py; a test compares the page numbers with core/finance.py for a fixed case.

## 3. New page: valuation tool (01)
- Routes: `/quanto-vale-meu-imovel` (city) and `/quanto-vale-meu-imovel/[cidade]/[bairro]` (neighborhood pre-filled, its numbers in the lead). The per-neighborhood page is indexable when the neighborhood is indexable. The estimate itself is client-side after submit: never put the address in the URL, never index a result.
- API: `GET /public/market/{city}/addresses?q=` (street + number suggestions from our streets/buildings, max 3 + coverage note) and `POST /public/market/{city}/valuation` with street, number, kind (apartment/house), built area, bedrooms, parking, approximate year (optional). Rate-limit both.
- Method (document it in `market_data/valuation.py` and test it): build comparable groups from cleaned ITBI sales in the last 24 months, from most to least specific — same street × same kind × area band; same neighborhood × kind × area band; same neighborhood × kind × construction-year band; neighbor neighborhoods × kind × area band. Use only groups with ≥ 10 sales. Estimate = weighted median R$/m² of the usable groups (weights favor the more specific groups) × area; range from the groups' p25–p75 R$/m², widened when there are fewer comparables. Confidence: Alta / Média / Baixa from the number of comparables and the spread (thresholds in config). Bedrooms and parking do not enter the math (ITBI doesn't have them); they go to the lead.
- Copy must describe what was actually computed. The mockups say "em até 1 km": we have no coordinates until GeoSampa is loaded, so use "na mesma rua", "no mesmo bairro" or "em bairros vizinhos" instead, and switch to distances only when coordinates exist.
- States: empty, autocomplete open, validation errors (summary + field errors, focus first error), loading ("Procurando vendas comparáveis…", aria-live), high confidence, low confidence (wider range, yellow-50 note), outside coverage (EmptyState + alert "Avise-me quando cobrirmos sua região", scope city), lead success. Always: "Estimativa estatística a partir de preços pagos. Não é laudo de avaliação."
- Lead: owner intents; a broker partner contacts the person. Copy must not promise a time or a result (CLAUDE.md rule 11).

## 4. New page: ITBI calculator (02)
- Route `/itbi/[cidade]`, only São Paulo for now. Pure function `core/itbi.py` with tests: tax base = max(price, venal value); general rate; reduced rate on the financed part under SFH up to a legal limit; optional programs. All rules come from config with an effective date (`ITBI_SP_RATE_BPS=300`, `ITBI_SP_SFH_RATE_BPS=50`, `ITBI_SP_SFH_LIMIT_CENTS` with no default, `ITBI_SP_RULES_REVIEWED=false`). While `ITBI_SP_RULES_REVIEWED` is false, the page is noindex, shows the "texto a revisar" markers from the mockup and stays out of the sitemap. I will check the rules against current law and flip the flag.
- Calculator states: empty, cash purchase, financed (two-part BreakdownTable), validation error (price missing), mobile with the total in a sticky bar. "Valor estimado. Confirme na guia oficial da Prefeitura." Registration costs as a range from config, labeled "estimativa".
- "Quanto se pagou de ITBI no seu bairro": median price and median estimated ITBI per neighborhood (apply core/itbi.py to each cleaned sale's tax base and financing; label it "ITBI mediano estimado"), linking to the price pages; city row highlighted.
- Explainer H2s as in the mockup (Quem paga, Quando pagar, Base de cálculo, ITBI com financiamento, Como emitir a guia) with a link to the official Prefeitura page. FAQPage structured data only after the rules are reviewed.

## 5. Street pages (06): new URL now, full content with SEO-2
- Move the street page from `/preco-m2/[cidade]/[bairro]/[rua]` to `/rua/[cidade]/[bairro]/[rua]` with a 301 (and the sitemap updated). This overrides the hub URL in docs/PROMPT_SEO_STREET_PAGES.md; update that doc in the same commit.
- Build the mockup layout now with the data we have: StreetQuickLinks (counts only with real listings, otherwise "Avise-me quando houver"), sales block (36-month window as in SEO-2, TurnoverLine only once the register exists), BuildingTable (core of the page), similar streets nearby (max 8), lead form. StockBlock, the houses-only state and the parent page `/rua/[cidade]/[rua]` need the IPTU register and street codes: build the components and stories now, render them once SEO-2 lands.

## 6. Listing pages (07): templates now, indexable with inventory
- Routes `/imoveis/aluguel/[cidade]/[bairro]`, `/imoveis/venda/[cidade]/[bairro]` and the same with `/[rua]`. Reconcile with the existing `/comprar` and `/alugar` search: say in your plan which one is canonical for a bairro/rua filter (these SEO URLs should be) and how search redirects or canonicalizes to them.
- FilterBar (desktop) / FilterSheet + active-filter chips (mobile); filters and sort as query params that keep the canonical on the clean URL; ResultsHeader with Lista/Mapa; PropertyCard grid with "Destaque pago" when sponsored; ListingDataStrip (rent: buildings of the area; sale: price actually paid, StatTiles); alert form with filters as chips; OwnerCTA; internal links (same search in neighbors, the other transaction, top streets).
- Rental median ("Aluguel mediano anunciado") only with ≥ 5 listings. Indexable only with ≥ 3 live authorized listings of that transaction (SEO-2 §5); below that `noindex,follow`, out of the sitemap, but the page renders for the alert.
- States: many, few (+ nearby listings labeled with their neighborhood), zero (the key state: EmptyState + alert as the main element + links), filters with zero matches (clear filters), loading skeleton, map view (approximate pins).

## 7. SEO plumbing
- generateMetadata from the keyword map; canonical to self; robots from the gates.
- Sitemaps: add templates `valuation`, `itbi`, `street`, `listings`; only indexable pages; `lastmod` = refreshed_at; IndexNow submits changed pages after each refresh (already wired for price pages).
- Structured data: BreadcrumbList everywhere; Dataset on pages showing ITBI numbers; Place on building and street; WebApplication on valuation and ITBI; ItemList only with real listings.
- Internal links as in 00-overview: neighborhood → streets, buildings, neighbors, financing, valuation; street → buildings, sale/rental, valuation, similar streets, neighborhood; building → street, other buildings, valuation with the address; listings → buildings, price pages, neighbors; tools link to each other. Never link from an indexable page to a 404.
- OpenGraph image per page with the headline number (existing generator).

## 8. Tests
- Backend: valuation groups, ≥ 10 rule, weighting, range widening, confidence levels, copy keys matching the groups used; address suggestions; ITBI function (cash, financed SFH within/above the limit, venal above price); median estimated ITBI; alert intents/scopes migration; MARKET_MIN_PRICE_GROUP applied everywhere; street 301s.
- Frontend: stories for every state on the states-components boards; titles/H1 per the keyword map; tooltip present wherever R$/m² renders; simulation badge on every financing number; listing pages never render a card without CRECI; noindex pages absent from sitemaps.
- Playwright at 390 and 1440 with seeded demo aggregates: valuation submit → result → lead with consent; ITBI financed case; neighborhood → street (new URL) → building → alert; rental page zero state → alert. Save screenshots to `apps/web/e2e/__screenshots__/seo/` and compare them by eye with docs/mockups/seo/ in your final report.

## Process
1. First reply with a plan: what already exists per page vs. the mockup (a gap list per folder), API changes and migrations, the valuation method with the thresholds you propose, the effect of MARKET_MIN_PRICE_GROUP=10, the listings/search canonical decision, and conflicts with CLAUDE.md or the SEO-1/SEO-2 docs. Wait for my "go".
2. Small commits, in this order: shared components → LeadAlertForm + alerts migration → restyle 04/04b → 03 → 05 → valuation → ITBI → street URL move → listing templates → SEO plumbing.
3. Run `make check` and report: what passed, pages per template indexable vs. noindex for wave 1, sitemap counts, and the screenshot comparison.
```

---

## Before pasting
- The mockups are in `docs/mockups/seo/` (PNG + HTML per page type). Commit them together with this prompt.
- The ITBI rules (3%, 0,5% on the SFH-financed part and its legal limit) are marked "texto a revisar". Check them against current São Paulo law before setting `ITBI_SP_RULES_REVIEWED=true`.
- Street stock, the houses-only state, building units and the long-street parent page need SEO-2 (IPTU register): run `docs/PROMPT_SEO_STREET_PAGES.md` before or after this one. This prompt moves the street URL to `/rua/...` and updates that doc.
- The neighborhood guide (`/bairros/...`) is not designed yet.
