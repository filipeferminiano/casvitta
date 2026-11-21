# Prompt for Claude Code — Milestone SEO-2: street pages for every residential street (São Paulo)

> Updated in SEO-3: street hubs live at `/rua/sao-paulo/[bairro]/[rua]` (the old `/preco-m2/sao-paulo/[bairro]/[rua]` URLs answer with a 301).

Paste the block below into Claude Code at the repo root. It builds on Milestone SEO-1 (ITBI pipeline and data pages, `docs/PROMPT_SEO_DATA_PAGES.md`). It does not need the marketplace to be finished: listing sections stay empty until authorized listings exist, and they fill in on their own when they do.

---

```
Milestone SEO-2: a page for every residential street segment in São Paulo, with a sale page and a rental page, fed by three sources: ITBI sales (from SEO-1), the IPTU property register (new) and our own authorized listings (when they exist). Read CLAUDE.md, docs/DESIGN_SYSTEM.md and docs/PROMPT_SEO_DATA_PAGES.md first; they are binding. Where this prompt changes an SEO-1 rule, this prompt wins, and you update the SEO-1 code and tests.

## Why
Sales alone are too thin: in the last 12 months 44% of streets had a single sale, and only ~2,000 had ≥10. But a street with one sale can have dozens of homes and a steady rental market. Rentals leave no public record, so the page content has to come from the housing stock (IPTU register), from the sales we do have (ITBI) and from our own listings. Pages are created for every residential street segment, and each one becomes indexable only when it has enough real content. This avoids thousands of thin pages, which would hurt the whole domain.

## Scope
In: IPTU register ingestion, street identity, street-segment and building stock aggregates, a new gate, the street hub page, street sale/rental pages (also at neighborhood level), rental/owner lead intents, sitemap rollout control, tests.
Out: showing crawled listings (never — see §6), rent price estimates or any number we don't have, AI-written copy, other cities (keep city as a dimension).

## 1. New source: IPTU property register (GeoSampa)
- São Paulo publishes the full IPTU fiscal register (TPCL, ~3.5M property records per year) as open data on GeoSampa (Decreto 56.701/2015). File: the latest yearly IPTU extract, in `data/raw/iptu/sao-paulo/` (git-ignored). Read the data dictionary that comes with it (`Dicionario_dados_IPTU.xlsx` on GeoSampa) and map columns by header with assertions, as in SEO-1 §2. Stream it (polars scan_csv / lazy); never load it whole. Watch encoding (often latin-1) and the decimal separator.
- Fields we need (exact header names from the file; confirm each in your plan): taxpayer number (SQL), street code (CODLOG) if present, street name, number, complement, neighborhood, CEP, condominium number if present, ideal fraction, land area, built area, use type, construction standard, construction year, number of floors.
- PRIVACY: the register can include the taxpayer's name and CPF/CNPJ. Drop those columns in the reader, before anything is written to disk or the database, and add a test that a fixture with those columns produces rows without them. Never publish per-unit values from this source (venal values, a single unit's area or year); only aggregates (§4).
- Store in `iptu_properties` (city_id, sql 11 digits, exercise_year, street_code, street_raw, number, unit_raw, neighborhood_raw, cep, condo_code, ideal_fraction, land_area_m2, built_area_m2, use_code, standard_code, construction_year, floors). Reuse the `iptu_use_codes` and `iptu_standard_codes` seed tables from SEO-1. CLI: `uv run python -m app.workers.iptu ingest --city sao-paulo --path data/raw/iptu/sao-paulo`; arq job for the yearly refresh. Idempotent on (sql, exercise_year).

## 2. Street identity (fixes an SEO-1 issue)
Street names repeat across the city (many "Rua São José"), so a street is never identified by name alone.
- Primary key of a street: the IPTU street code (CODLOG) when the file has it; otherwise normalized name + neighborhood.
- A page belongs to a street segment = street × neighborhood. Long streets that cross neighborhoods (e.g. Rua Vergueiro) get one segment page per neighborhood plus a parent page `/rua/sao-paulo/[rua]` that lists its segments, only when the street code proves they are the same street.
- Link ITBI to IPTU by SQL (11 digits). This gives each ITBI sale a street code, a condominium and, where the ITBI Bairro is empty, a better neighborhood candidate. Report the join rate per year; target ≥ 95%.
- Migrate `streets` to: city_id, street_code (nullable), name, slug, plus a new `street_segments` (street_id, neighborhood_id, slug, wave, is_indexable, indexable_since). Keep `slug_redirects` working for any SEO-1 street URL that changes.

## 3. Buildings from the register
- A building = one condominium code (or, if absent, setor + quadra + street + number). Display name: the SEO-1 rule (most frequent clean `reference_raw`), else "Edifício na <rua>, <número>".
- Stock per building: residential units, construction year (mode), floors (max), standard (mode), built-area range of units (p10–p90, only if ≥ 5 units).

## 4. Aggregates (rebuilt after each ITBI or IPTU ingestion)
`street_segment_stats` and `neighborhood_stock_stats`:
- Stock (IPTU): residential units total; split apartments / houses; number of residential buildings; median construction year; median built area by kind; standard mix (shares); share of units in buildings with ≥ N floors.
- Sales (ITBI, from SEO-1): change the street window to the last 36 months (the page may also show the last 12). Count, median value, median R$/m² de área construída (IPTU), financed share, last sale month. Price fields only above the threshold (§5).
- Listings (our `listings` table): live, authorized marketplace listings in the segment, by transaction (sale / rent): count, median asking price, median rent, median condo fee. These are our listings only.
- Turnover, from ITBI ÷ stock: "X% das unidades desta rua foram vendidas nos últimos 3 anos", shown only when both numbers pass their thresholds.
- Neighbor segments: other segments in the same neighborhood ranked by similarity of stock (kind mix, median year, median area), for internal links.

## 5. Gates (config, with tests; replaces SEO-1 §6 for streets)
Every residential street segment gets a page. Each page decides its own robots and sitemap status:
- Street hub `/rua/sao-paulo/[bairro]/[rua]` is indexable when its neighborhood is indexable AND at least one of:
  a. ≥ 10 ITBI sales in 36 months (`STREET_MIN_SALES_36M=10`), or
  b. ≥ 30 residential units in the register (`STREET_MIN_UNITS=30`), or at least one residential condominium with ≥ 20 units, or
  c. ≥ 3 live authorized listings of any transaction (`STREET_MIN_LISTINGS=3`).
- Street sale page and rental page: indexable only when that transaction has ≥ 3 live authorized listings in the segment. Below that they render (useful content + alert form) with `noindex,follow`, outside the sitemap.
- Price numbers from ITBI only with ≥ 10 sales in the window; listing price medians only with ≥ 5 listings. Rounding as in SEO-1.
- Segments with no residential stock and no sales get no page (404; listed only on the neighborhood page).
- Gate status is recomputed after every ingestion and listing change; a page that drops below the gate becomes noindex (never deleted, so links don't break).
- Rollout control: `STREET_INDEX_WAVES=1` (only wave 1 neighborhoods from SEO-1 seed) and `STREET_INDEX_MAX_NEW_PER_WEEK=500`. New indexable pages go into the sitemap in that order: (a) before (b) before (c), most sales first. Record `indexable_since` so we can compare cohorts in Search Console.

## 6. Listings on public pages (CLAUDE.md §4.1 and §4.2 apply)
- Only listings from our `listings` table with channel marketplace, status live, an owner authorization that covers that transaction and is not expired, and a broker with validated CRECI. Each card shows the CRECI.
- Crawled or third-party listings are never shown, counted or summarized on a public page, not even as "X anúncios em outros sites". The crawl is an internal sales tool only.
- Until listings exist, the listing section shows an empty state with the alert form, not placeholders or fake cards. Demo data (`is_demo`) never appears on these pages.

## 7. Pages (apps/web, (marketplace) route group, SSR + ISR on data refresh)
Copy in pt-BR from the message catalog; template sentences filled with numbers; no AI text.
1. Street hub `/rua/sao-paulo/[bairro]/[rua]` (extends the SEO-1 street page): headline about the street ("Rua Joaquim Távora, Vila Mariana: 1.240 apartamentos em 38 prédios"), stock block (kind mix, buildings, median year, typical size, standard mix), sales block (or a short "poucas vendas registradas" line with the count only, below threshold), turnover line, buildings on the street (links to `/condominio/...`), live listings summary with links to the sale and rental pages, neighbor segments, link up to the neighborhood, financing CTA, lead capture.
2. Street sale page `/imoveis/venda/sao-paulo/[bairro]/[rua]` and rental page `/imoveis/aluguel/sao-paulo/[bairro]/[rua]`: lead with the live listings (cards per DESIGN_SYSTEM), then a compact stock and sales summary that links to the hub (don't repeat the hub's full content), buildings with listings, nearby listings in the same neighborhood when the street has few, alert form with the matching intent.
3. Neighborhood sale and rental pages `/imoveis/venda/sao-paulo/[bairro]` and `/imoveis/aluguel/sao-paulo/[bairro]`, same template one level up, with the top streets by stock and by listings. Gate: indexable when the neighborhood is indexable and has ≥ 3 live listings of that transaction.
4. Parent street page `/rua/sao-paulo/[rua]` for multi-neighborhood streets (§2): segments with their stock and sales counts.
- Building pages (`/condominio/...` from SEO-1) gain the stock block from §3 and use the same gate idea: indexable with ≥ 3 sales in history OR ≥ 20 units.
- Titles and descriptions come from data and differ by page type: hub "Rua X (Bairro): imóveis, preço do m² e vendas reais"; rental "Apartamentos para alugar na Rua X, Bairro"; sale "Imóveis à venda na Rua X, Bairro". Canonical to self. If the URLs of the marketplace search (Milestone 2) cover the same filter, use these URLs as the canonical ones and make search redirect or canonicalize to them; say in your plan how you reconcile the two.
- Structured data: BreadcrumbList everywhere; `Place` with address for the hub; `ItemList` of listings on sale/rental pages (only real listings); `Dataset` only where ITBI numbers are shown.
- Internal links: neighborhood → top segments; hub ↔ its sale and rental pages; hub → buildings; hub → neighbor segments (max 8); building → its street hub. No link from an indexable page to a 404.
- Use packages/ui components and tokens. In your plan, give an ASCII wireframe per new page and list new components (e.g. StreetStockBlock, TurnoverLine, ListingCardGrid empty state, SegmentList) with Storybook stories for all states.

## 8. Leads
- Extend `property_alerts`: scope adds `street_segment`; intent becomes buy / rent / own_sell / own_rent. Rental page defaults to rent; owner CTA "Quer alugar ou vender seu imóvel nesta rua?" creates own_rent / own_sell alerts (supply for brokers).
- Same consent rules as SEO-1 §8 (`contact_about_properties` required, unchecked by default), honeypot, rate limit. Still no outbound messages; internal admin list with filters by intent and neighborhood, and a count of alerts per segment (this tells us where rental demand is).

## 9. Tests
- IPTU reader: header assertions, encoding, decimal parsing, taxpayer name/CPF/CNPJ columns dropped before persistence (fixture), idempotent re-ingest.
- Street identity: two "Rua São José" in different neighborhoods stay separate; one long street in two neighborhoods → two segments + one parent; SQL join and its rate report.
- Aggregates: stock counts, kind mix, building grouping by condo code, turnover only above both thresholds, 36-month sales window.
- Gates: each of a/b/c alone makes the hub indexable; none → noindex and absent from sitemap; sale/rental pages need ≥ 3 listings of their transaction; expired authorization or missing CRECI removes a listing and can flip a page to noindex; demo listings never counted; crawled listings never reachable from public code (no import path from the crawl module to the web API used by these pages); weekly rollout cap respected.
- Frontend: stories for every state (no sales, sales below threshold, no listings, listings); titles differ by page type; noindex pages absent from sitemaps.
- Playwright: neighborhood → street hub → rental page (empty state) → submit rent alert → row exists with consent; with seeded authorized listings the rental page shows cards with CRECI and becomes indexable.

## Process
1. First reply with a plan: migrations, how you read the IPTU file (actual headers, row count, encoding, which columns you drop), the street-code decision, ITBI↔IPTU join rate, wireframes, new components, and — for wave 1 neighborhoods and for the whole city — how many street segments pass each gate (a, b, c) and how many would be indexable at launch. Flag anything that conflicts with CLAUDE.md or SEO-1. Wait for my "go".
2. Small commits: IPTU ingestion → street identity + migration → aggregates → gates + rollout → hub page → sale/rental pages → leads → SEO plumbing.
3. Run `make check` and report: rows read/kept from IPTU, columns dropped, join rate, segments per gate, indexable pages per template for wave 1, and sitemap counts.
```

---

## Before pasting
- Download the IPTU register: on GeoSampa (geosampa.prefeitura.sp.gov.br) open the download section, choose the IPTU / cadastro fiscal layer and download the latest yearly file, plus `Dicionario_dados_IPTU.xlsx`. Put both in `~/casvitta/data/raw/iptu/sao-paulo/` (already git-ignored under `data/raw/`). Metadata page: https://metadados.geosampa.prefeitura.sp.gov.br/geonetwork/srv/api/records/b971efa1-aad5-42f3-ad28-18f1f4efe270
- Run SEO-1 first, or together: SEO-2 changes the street window (36 months) and street identity, so if SEO-1 is already merged Claude Code will migrate it.
- New settings to add to `.env.example`: `STREET_MIN_SALES_36M`, `STREET_MIN_UNITS`, `STREET_MIN_LISTINGS`, `STREET_INDEX_WAVES`, `STREET_INDEX_MAX_NEW_PER_WEEK`, IPTU path.
