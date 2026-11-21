# Prompts for Claude Design — programmatic SEO landing pages (Casvitta, São Paulo)

One prompt per page type. Each targets a search people actually type. Paste the **shared brief** first, then one page prompt. Do one page type per session, so each design stays a separate artifact you can review.

Recommended order (by search demand we can win now): 1 Valuation → 2 ITBI calculator → 3 Building → 4 Neighborhood price → 5 Financing → 6 Street → 7 Sale/rental listings → 8 Neighborhood guide.

The sample numbers come from the real 2026 ITBI data (12 months to Aug 2026). They are only for the mockups.

---

## Shared brief (paste first in every session)

```
You are designing public landing pages for Casvitta, a São Paulo real-estate marketplace and broker platform. These pages are built programmatically, one per neighborhood, street, building, etc., to rank on Google. Each design must work as a template: the same layout has to hold for a page full of data and for a page with little data.

Design system "Planta" (binding):
- The property as an architectural project: fine 1px lines, a visible grid, numbers in a monospaced face. Calm, exact, transparent about money. Ink and paper ≈ 90% of every screen.
- Colors: ink-900 #0F1E3D (text, dark surfaces), ink-700 #23345A, ink-500 #4A5568 (muted text, labels), ink-300 #9AA5B8 (dashed borders, never text), ink-200 #D6DCE5 (lines, card borders), ink-100 #EEF1F5 (chips), paper #F5F7FA (background), surface #FFFFFF (cards). Blue only for action: blue-600 #1D4ED8 (primary buttons, links, focus), blue-700 #1739A6, blue-50 #EAF0FD. Yellow only for attention: yellow-400 #F2B23A (text on it is ink-900), yellow-50 #FDF3DC. Green #157F4C / red #B42318 only for meaning, never decoration.
- Type: Familjen Grotesk 600 for headings (display-xl 48/52, display-l 32/38, title 22/28); IBM Plex Sans for body (16/24, body-s 14/20, caption 12/16 ink-500); IBM Plex Mono with tabular numbers for every price, metric, date and CRECI number (value 24/28 600; eyebrow 12/16 uppercase +0.08em ink-500).
- Layout: spacing 4/8/12/16/24/32/48/64; radius 4 chips, 6 buttons/inputs, 10 cards; 1px ink-200 borders instead of shadows. Mobile-first: design 390 px first, then 1440 px (12 columns, 24 gutter, 32 margin; content max width ~1120). Body copy ≤ 65 characters per line. Lucide icons at 1.6 stroke. No emoji, no stock-photo heroes.
- Logo: the "Casa aberta" mark (a C-shaped house outline in ink-900 with a yellow-400 dot) + "CASVITTA" in Familjen Grotesk 700.
- Mandatory badges: "Simulação · não é aprovação" (ink-100 bg, ink-500 text) on every financing number; "CRECI-SP 000.000-F" (Plex Mono 12, 1px ink-900 border) on every listing and broker card; "Feito por IA" only if AI text appears (it shouldn't on these pages); "Demonstrativo" (yellow-400, ink-900, 11px bold uppercase) once near the top of every mockup, because the numbers are examples.
- Voice (all UI copy in Brazilian Portuguese): exact and calm, no hype, no exclamation marks. Example: "Em 12 meses, 2.109 imóveis foram vendidos na Vila Mariana." Never "Imperdível!".

Data rules that change the design:
- Our edge: prices actually PAID, from São Paulo's ITBI tax records, not asking prices. Say so plainly, with the source line "Fonte: Prefeitura de São Paulo — guias de ITBI · Atualizado em dd/mm/aaaa" near the numbers.
- Price per m² is "R$/m² de área construída (IPTU)", which includes common areas, so it is lower than listing prices per m². Every place showing it needs an info tooltip explaining this.
- Privacy: never show a single sale, an exact sale date, unit numbers or owner data. Prices appear only for groups of ≥10 sales; below that, show the count and a "poucas vendas registradas" state.
- Listings shown are only our own authorized listings, each with the broker's CRECI. If there are none, show an empty state with an alert form. No placeholder or fake listing cards.

SEO elements every page must show visibly: breadcrumb (São Paulo › Bairro › Rua › Prédio as applicable), one H1 built from data, a 1–2 sentence lead paragraph with the key numbers (this is what Google will quote), section headings that match real questions, an internal-links block (neighbors / nearby streets / buildings), the source and update line. FAQ only if the questions are real and answered on the page.

Lead capture component ("LeadAlertForm"), reused everywhere: name, WhatsApp, optional email, intent (radio, varies by page), consent checkbox "Aceito ser contatado sobre imóveis" unchecked by default and required, small privacy line. Success state: "Pronto. Avisaremos pelo WhatsApp quando houver novidade."

For every page deliver: mobile 390 and desktop 1440; the states listed in the page prompt; component callouts for anything new (name, purpose, states). Reuse existing components where they fit: StatTile, DataTable, PropertyCard, FinancingSimulation, Badge, Chip, Tabs, SegmentedControl, EmptyState, LoadingState, ErrorState.
```

---

## 1. Valuation tool — "Quanto vale meu apartamento"

```
Page type: valuation tool for owners. Most valuable page: it targets high-volume searches and brings in owners (supply for brokers).
Target searches: "quanto vale meu apartamento", "quanto vale meu imóvel", "avaliação de imóvel grátis", "quanto vale meu apartamento na Vila Mariana".
URLs: /quanto-vale-meu-imovel (city) and /quanto-vale-meu-imovel/sao-paulo/[bairro] (one per neighborhood, same template with the neighborhood pre-filled and its numbers in the lead paragraph).

Goal: the owner enters an address and gets an honest value range based on real sales nearby, then leaves contact details to get a broker's precise valuation or to sell/rent.

Flow and sections:
1. Hero: H1 "Quanto vale seu apartamento na Vila Mariana?" (city version: "Quanto vale seu imóvel em São Paulo?"); lead "Calculamos com base em 2.109 vendas reais registradas na Prefeitura nos últimos 12 meses, não em preços de anúncio." Address input (street + number, autocomplete), then type (apartamento / casa), área (m²), quartos, vagas, ano aproximado (optional). One primary button "Ver estimativa". Note under the form: "Não pedimos seu nome para mostrar a estimativa."
2. Result (same page, scrolls into view): value range as the hero number in mono ("R$ 690 mil – R$ 810 mil"), the middle estimate smaller, and a confidence label (Alta / Média / Baixa) with one line explaining why ("baseado em 38 vendas comparáveis em 1 km"). Show how it was calculated: a short list of comparable groups, never single sales (e.g. "Apartamentos de 90–120 m² na Rua Joaquim Távora · 62 vendas · mediana R$ 775 mil"), the R$/m² tooltip, the source line.
3. Context: neighborhood median price and R$/m² with 12-month change (StatTiles), a small chart of the last 5 years.
4. Next step (owner lead): "Quer um valor exato? Um corretor parceiro avalia sem custo." LeadAlertForm with intent radio: Quero vender / Quero alugar / Só quero saber o valor. Below it, a line on what happens next and when they'll be contacted.
5. "Como calculamos" explainer (3 short steps), plus why ITBI data is more reliable than asking prices.
6. Internal links: valuation pages of neighboring neighborhoods; the neighborhood price page; the ITBI calculator.

States: empty (form only); loading result (skeleton + "Procurando vendas comparáveis…"); result with high confidence; low confidence (few comparables: wider range, yellow-50 note "Poucas vendas parecidas por perto. Use como referência inicial."); address outside coverage (EmptyState with an alert form "Avise-me quando cobrirmos sua região"); form validation errors.
Sample data: Vila Mariana 2.109 sales in 12 m, median R$ 750 mil, R$ 6.940/m² (IPTU), +1,8% vs. previous 12 m; Rua Joaquim Távora 62 sales, median R$ 775 mil, R$ 8.110/m².
New components to call out: AddressAutocomplete, ValueRangeResult (with confidence), ComparableGroupList.
```

---

## 2. ITBI calculator — "Calcular ITBI em São Paulo"

```
Page type: tool and explainer. Targets high-volume informational searches; brings in buyers who are about to close a purchase.
Target searches: "calcular ITBI São Paulo", "ITBI SP valor", "quanto é o ITBI em São Paulo", "valor venal de referência", "ITBI financiamento SFH".
URL: /itbi/sao-paulo (one city page; later other cities as /itbi/[cidade]).

Sections:
1. Hero: H1 "Calcule o ITBI do seu imóvel em São Paulo"; lead in 2 sentences on what ITBI is and that the rate is 3% (with the reduced rate on the financed part under SFH, within the legal limit). Leave the rules as editable copy blocks, marked "texto a revisar", so a person checks them against current law before launch.
2. Calculator card: purchase price (CurrencyInput), valor venal de referência (optional, with a "Onde encontro?" link), financing yes/no → financed amount and system (SFH / outro), first-time buyer program checkbox if applicable. Result: tax base used (the higher of price and venal value), ITBI total in mono, breakdown table (financed part vs. rest), "Valor estimado. Confirme na guia oficial da Prefeitura." Secondary output: registration costs as a range, clearly labeled estimate.
3. "Quanto se pagou de ITBI no seu bairro": small table of 5–8 neighborhoods with median price and median ITBI (from real sales), linking to the neighborhood price pages.
4. Explainer sections as real questions (H2): "Quem paga o ITBI?", "Quando pagar?", "Base de cálculo: preço ou valor venal?", "ITBI com financiamento", "Como emitir a guia". Short answers, with a link to the official Prefeitura page.
5. Lead: "Comprando um imóvel? Receba imóveis parecidos e uma simulação de financiamento." LeadAlertForm, intent: Estou comprando / Só pesquisando.
6. Links: financing page, valuation tool, neighborhood price index.

States: empty calculator; filled result; financing case (two-part breakdown); validation error (price missing); mobile with the result sticky at the bottom.
New components: TaxCalculatorCard, BreakdownTable (reuse DataTable styles).
```

---

## 3. Building page — "Edifício X, Rua Y"

```
Page type: one page per residential building (condominium). Strongest fit for the real data: people search building names before buying, renting or visiting.
Target searches: "edifício [nome]", "condomínio [nome] [rua]", "[nome do prédio] vila mariana", "apartamento edifício [nome]", "[rua] [número]".
URL: /condominio/sao-paulo/[bairro]/[predio].

Sections:
1. Header: breadcrumb; H1 "Edifício Maison Blanche · Rua Joaquim Távora, 1.240 — Vila Mariana"; facts row in mono chips: construído em 1998 · 14 andares · 56 apartamentos · padrão médio. Small static map (street-level, no satellite photo of the building).
2. Lead paragraph with data: "Desde 2019, 21 apartamentos deste prédio foram vendidos. Mediana: R$ 720 mil."
3. Sales block (only when ≥ 3 sales in history; prices only above the group threshold): StatTiles (sales since 2019, median price, R$/m² IPTU with tooltip, % with financing); sales count per year as a simple bar chart. No unit numbers, no single sales.
4. Units: area range of the units (e.g. "de 68 a 112 m² de área construída"), mix by size band.
5. Live listings in the building (our authorized listings, PropertyCard with CRECI). Empty state: "Nenhum apartamento deste prédio está anunciado agora." with LeadAlertForm, intent: Quero comprar aqui / Quero alugar aqui.
6. Owner block (yellow-50 panel): "Você mora neste prédio? Saiba quanto vale seu apartamento", linking to the valuation tool with the address pre-filled; second CTA "Quero vender ou alugar".
7. Context: the street (link to the street page), neighborhood medians for comparison ("Este prédio está 8% acima da mediana da Vila Mariana por m²"), other buildings on the same street (list with year and units).
8. Source line.

States: rich (sales + listings); stock only (few sales: show the count, no prices, "poucas vendas registradas"); no listings (empty state); building with no name (H1 "Edifício na Rua Joaquim Távora, 1.240").
New components: BuildingFactsRow, SalesPerYearBars, OwnerCTA panel, BuildingList.
```

---

## 4. Neighborhood price page — "Preço do m² na Vila Mariana"

```
Page type: one page per neighborhood with real sale prices. Medium volume; competes with FipeZAP and the portals by using prices actually paid.
Target searches: "preço m² vila mariana", "valor do metro quadrado vila mariana", "quanto custa um apartamento na vila mariana", "preço apartamento vila mariana 2026". City index: "preço do m² em São Paulo por bairro".
URLs: /preco-m2/sao-paulo (index) and /preco-m2/sao-paulo/[bairro].

Neighborhood page sections:
1. H1 "Preço do m² na Vila Mariana: R$ 6.940 (vendas reais de 2026)"; lead "Em 12 meses, 2.109 imóveis foram vendidos na Vila Mariana, pela mediana de R$ 750 mil. 30% foram comprados com financiamento."
2. StatTiles: median price, R$/m² IPTU (tooltip), sales in 12 m with change vs. previous 12 m, % financed.
3. 5-year chart: median R$/m² and sales count per month (two series, clear axes, mono labels).
4. "Quanto custa por tamanho": table by area band (até 50 m², 50–80, 80–120, 120+): sales, median price, median R$/m².
5. "Ruas com mais vendas": top 10 streets table (street, sales, median price), linking to street pages. Sample: Rua Vergueiro 394 · R$ 410 mil; Rua Joaquim Távora 62 · R$ 775 mil; Rua Domingos de Morais 39 · R$ 440 mil.
6. "Prédios com mais vendas": top buildings, linking to building pages.
7. Compare with neighbors: table of neighboring neighborhoods (Moema, Aclimação, Vila Clementino, Paraíso, Saúde) with median R$/m² and 12-month change.
8. CTAs: "Quanto preciso ganhar para comprar aqui?" (financing page); "Quanto vale o seu imóvel?" (valuation); LeadAlertForm, intent: Quero comprar / Quero alugar / Tenho imóvel aqui.
9. Method note + source line.

Index page: H1 "Preço do m² em São Paulo por bairro"; searchable, sortable table of all neighborhoods (name, median R$/m², median price, sales 12 m, change), zone filter (SegmentedControl: Todas / Centro / Sul / Oeste / Norte / Leste); a map placeholder is optional.
States: full data; neighborhood below threshold (count only + links to neighbors; mark as noindex in the annotation); loading; error.
Sample: Vila Mariana as above; Saúde 2.197 sales · R$ 479 mil · R$ 4.840/m²; Tatuapé 2.386 · R$ 587 mil · R$ 5.070/m²; city 85.577 sales · R$ 459 mil · R$ 4.880/m².
New components: MonthlySeriesChart, AreaBandTable, NeighborComparisonTable, ZoneFilter.
```

---

## 5. Financing page — "Quanto preciso ganhar para comprar na Vila Mariana"

```
Page type: one page per neighborhood, a calculator plus context. Targets buyers early in the journey.
Target searches: "quanto preciso ganhar para financiar um apartamento", "renda para financiar imóvel de 750 mil", "simulação financiamento vila mariana".
URL: /financiamento/sao-paulo/[bairro].

Sections:
1. H1 "Quanto você precisa ganhar para comprar na Vila Mariana"; lead "Um apartamento típico aqui custou R$ 750 mil. Com 20% de entrada e 30 anos, a renda familiar indicada é de cerca de R$ 21 mil por mês." Show the badge "Simulação · não é aprovação" next to the number.
2. Simulator (reuse FinancingSimulation): property value (pre-filled with the neighborhood median, editable), down payment, FGTS, term, system (SAC / Price). Outputs: first installment, last installment (SAC), minimum income at 30% commitment, total interest. Show the rate used as "taxa ilustrativa de 11,5% a.a." and that insurance and fees are not included.
3. Real context from ITBI: "Nas compras de 2026 na Vila Mariana, 30% usaram financiamento, cobrindo em média 60% do valor." Small chart of the financed share by year.
4. "E em bairros vizinhos?": table of the neighbors with median price and indicated income.
5. Lead: "Quer ver imóveis dentro do seu orçamento?" LeadAlertForm with a budget field, intent: Quero comprar.
6. Links: neighborhood price page, ITBI calculator, valuation.

States: default (median pre-filled); user-edited; SAC vs Price toggle; validation (down payment below the minimum); mobile with the result pinned.
Rules: never "aprovado", never promise credit; the simulation badge appears on every financing number.
New components: IncomeNeededResult, NeighborIncomeTable.
```

---

## 6. Street page — "Rua Joaquim Távora, Vila Mariana"

```
Page type: one page per street segment (street × neighborhood). It is the hub that links to the street's buildings, sale and rental pages. It does NOT target "preço m² rua X" (nobody searches that); it targets people looking up a street before moving or buying there.
Target searches: "rua joaquim távora vila mariana", "morar na rua [x]", "prédios na rua [x]", "apartamentos rua [x]".
URLs: /rua/sao-paulo/[bairro]/[rua]; for long streets crossing several neighborhoods, a parent /rua/sao-paulo/[rua] listing the segments.

Sections:
1. H1 "Rua Joaquim Távora, Vila Mariana"; lead "1.240 apartamentos em 38 prédios, a maioria construída entre 1980 e 2005. 62 imóveis foram vendidos aqui nos últimos 12 meses."
2. Quick links row (prominent, top of page): "Apartamentos à venda (4)" · "Para alugar (7)" · "Quanto vale o meu" → the sale/rental pages and the valuation tool. Show the counts only when listings exist; otherwise the link reads "Avise-me quando houver".
3. Stock block: units by type (apartamentos / casas), number of buildings, median construction year, typical size, construction standard mix. Use a compact horizontal bar or chips, not a pie.
4. Sales block (if ≥ 10 sales in 36 m): median price, R$/m² IPTU, sales per year; a turnover line "5% das unidades desta rua foram vendidas nos últimos 3 anos". Below threshold: "Poucas vendas registradas (4 em 3 anos)."
5. Buildings on this street: list/table (name or "Edifício nº 1.240", year, floors, units, sales since 2019) → building pages. This is the core of the page.
6. Nearby streets in the same neighborhood with similar housing (max 8 links), plus a link up to the neighborhood.
7. Lead: LeadAlertForm, intent: Quero comprar / Quero alugar / Tenho imóvel nesta rua.
8. Source line.
Parent page (long streets): H1 "Rua Vergueiro"; table of segments (neighborhood, buildings, units, sales), linking to each.

States: rich (sales + listings); stock only (no sales above threshold, no listings); houses-only street (no buildings list: show the house count and typical lot size instead); parent page.
Sample: Rua Joaquim Távora: 62 sales in 12 m, median R$ 775 mil, R$ 8.110/m² IPTU. Rua Vergueiro (Vila Mariana segment): 394 sales, median R$ 410 mil, typical 71 m².
New components: StreetQuickLinks, StockBlock, TurnoverLine, BuildingTable, SegmentTable.
```

---

## 7. Sale and rental listing pages — "Apartamentos para alugar na Vila Mariana" / "… na Rua X"

```
Page type: filtered listing pages, at neighborhood level and street level, for sale and for rent. These are the highest-volume searches. They only rank once we have inventory, so the design has to look good with 2 listings and also with 200, and have an honest empty state.
Target searches: "apartamento para alugar vila mariana", "aluguel vila mariana", "apartamento à venda vila mariana", "apartamento para alugar rua joaquim távora", "apartamento 2 quartos vila mariana".
URLs: /imoveis/aluguel/sao-paulo/[bairro], /imoveis/venda/sao-paulo/[bairro], and the same with /[rua].

Sections:
1. H1 from data: "Apartamentos para alugar na Vila Mariana" + count chip "7 anúncios"; lead with what the data adds: "Aluguel mediano anunciado: R$ 4.200 + condomínio. Preço mediano de venda registrado: R$ 750 mil." (rental medians come from our listings, only with ≥5).
2. Filter bar: Tipo, Quartos, Preço (range), Vagas, Área; sort (Mais recentes / Menor preço / Maior área). Mobile: a "Filtros" button opening a Sheet, plus horizontal chips for active filters.
3. Results: PropertyCard grid (photo, type · neighborhood, price in mono, rent + condo fee + IPTU for rentals, specs, broker name + CRECI footer). Sponsored cards with the "Destaque pago" badge. View toggle: Lista / Mapa.
4. Below the results, a data strip that sets us apart: "Antes de alugar, veja os prédios": the top buildings of the area with year and units → building pages; for sale pages: "Preço real pago nesta rua" StatTiles → street/neighborhood price page.
5. Alert: "Não achou? Receba novos anúncios no WhatsApp." LeadAlertForm with the current filters shown as chips, intent pre-set (rent or buy).
6. Owner CTA (yellow-50): "Tem imóvel aqui? Anuncie com um corretor parceiro" → valuation tool.
7. Internal links: same search in neighboring neighborhoods; the other transaction ("Ver imóveis à venda"); top streets.

States: many results; few results (2 cards + "Veja também em bairros vizinhos" with cards from nearby); ZERO results, a key state (no fake cards: EmptyState "Ainda não há apartamentos para alugar na Rua Joaquim Távora." + alert form as the main element + links to the neighborhood page and nearby streets); filters with zero matches ("Nenhum anúncio com esses filtros", with a button to clear them); loading skeleton; map view.
New components: FilterBar + FilterSheet, ResultsHeader, ListingDataStrip, ZeroResultsAlert.
```

---

## 8. Neighborhood guide — "Morar na Vila Mariana" (later)

```
Page type: one editorial-plus-data page per neighborhood. Medium volume; needs real written content (by a person, not AI), so design the template with clear slots for editorial text next to the data blocks.
Target searches: "morar na vila mariana", "vila mariana é um bom bairro para morar", "como é morar na vila mariana", "vila mariana ou moema".
URL: /bairros/sao-paulo/[bairro].

Sections:
1. H1 "Morar na Vila Mariana"; editorial intro slot (2–3 paragraphs, ≤ 65 characters per line); facts sidebar on desktop (median price, R$/m², rent median when available, % apartments, typical building age, metro stations as text).
2. "Quanto custa morar aqui": buy and rent numbers side by side, linking to the price, financing and listing pages.
3. "Perfil dos imóveis": stock mix (apartments vs. houses, building age, size bands) from the IPTU register.
4. "Ruas e prédios": top streets by stock and by sales → street pages.
5. Editorial slots with H2s phrased as real questions: "Como é o transporte?", "Para quem combina?", "Vila Mariana ou Moema?" (comparison table with the neighbor's numbers).
6. Lead: LeadAlertForm, intent: Quero comprar / Quero alugar.
7. Neighbors: cards linking to the other neighborhood guides.
8. Author line for the editorial text ("Texto: [nome], [data]") and the source line for the data.
States: full (editorial written); data-only draft (editorial slots shown as dashed ink-300 placeholders, annotated "não publicar sem texto"); mobile.
New components: GuideFactsSidebar, EditorialBlock, NeighborhoodVsTable.
```

---

## After the designs
- Export each approved design to `docs/mockups/seo/` (PNG + HTML, one folder per page type) so Claude Code can follow them in SEO-1 and SEO-2.
- SEO-1 and SEO-2 still need re-scoping around these page types: valuation and ITBI calculator added; street pages retitled; building pages moved up.
