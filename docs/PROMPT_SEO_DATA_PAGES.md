# Prompt for Claude Code — Milestone SEO-1: ITBI data pipeline + data-only SEO pages (São Paulo)

Paste the block below into Claude Code at the repo root. It assumes Milestone 0 (foundation) is merged; it does not depend on Ads Studio or the WhatsApp agent.

---

```
Milestone SEO-1: São Paulo real-transaction data pipeline (ITBI) and the first programmatic SEO pages. These pages use only public data, so they can go live before we have any listings. Read CLAUDE.md and docs/DESIGN_SYSTEM.md first; they are binding.

## Why
Google takes months to rank a new domain, so we start the clock now with pages that need no listings: real prices paid (ITBI) per neighborhood, street and building, plus a "how much income do I need to buy here" page built on core/finance.py. Portals show asking prices; we show prices actually paid. Every page also captures buyer leads ("let me know about properties on this street/building").

## Scope
In: ITBI ingestion, normalization, aggregation, 4 page templates + 1 index, lead capture, sitemaps, structured data, tests.
Out: listings, crawling, ads, AI-written copy, other cities (keep city as a dimension in every table and URL so adding cities later is config, not a migration).

## 1. Source files (already in the repo, git-ignored)
Source: São Paulo's Secretaria Municipal da Fazenda, "Dados das Transações Imobiliárias com recolhimento de ITBI" (https://prefeitura.sp.gov.br/fazenda/w/acesso_a_informacao/31501). The files are in `data/raw/itbi/sao-paulo/`:

| File | Year | Monthly tabs |
|---|---|---|
| GUIAS_DE_ITBI_PAGAS_(2019).xlsx | 2019 | JAN-2019 … DEZ-2019 |
| GUIAS_DE_ITBI_PAGAS_(2020).xlsx | 2020 | 12 |
| GUIAS_DE_ITBI_PAGAS_(2021).xlsx | 2021 | 12 |
| GUIAS_DE_ITBI_PAGAS_12-2022.xlsx | 2022 | 12 |
| GUIAS-DE-ITBI-PAGAS-2023.xlsx | 2023 | 12 |
| GUIAS-DE-ITBI-PAGAS-2024.xlsx | 2024 | 12 |
| GUIAS DE ITBI PAGAS (28012026) XLS.xlsx | 2025 | 12 |
| GUIAS DE ITBI PAGAS (03112026).xlsx | 2026 | JAN-2026 … SET-2026 (updated monthly) |

Do not rely on file names to infer the year: read the tab names (`MMM-YYYY`, Portuguese month abbreviations). Every file also has 4 reference tabs: `LEGENDA`, `EXPLICAÇÕES` (field dictionary — read it), `Tabela de USOS` and `Tabela de PADRÕES` (code → description; load both as seed tables `iptu_use_codes` and `iptu_standard_codes`).

Volume: about 14,700 rows per month (~13,000 of them "1.Compra e venda"), so roughly 1.2M rows across all files. Use a streaming reader (`python-calamine`/`fastexcel` via polars, or openpyxl `read_only=True`), one tab at a time; never load a whole workbook into memory.

## 2. Column map (inspected from the files — map by position, validate by header)
Header row is row 1 of each monthly tab, except JAN-2024 and OUT-2024, which have NO header row (data starts in row 1): detect this (first cell numeric) and apply the 2019–2024 column map without the header assertion, and log it. The first 26 columns are the same in all vintages:

| # | Header | Field | Notes |
|---|---|---|---|
| 0 | N° do Cadastro (SQL) | sql | Numeric, leading zeros lost: zero-pad to 11 digits = setor(3) quadra(3) lote(4) check digit(1). Never published. |
| 1 | Nome do Logradouro | street_raw | e.g. "R MONTESQUIEU" |
| 2 | Número | street_number | |
| 3 | Complemento | unit_raw | e.g. "AP 201 E 3VGS". Never published. Use only to detect bundled parking ("VG", "VGS") and unit type. |
| 4 | Bairro | neighborhood_raw | Free text, max 22 chars, and EMPTY in ~41% of rows (JAN-2026: 6,065 of 14,734). Sometimes holds spill-over text ("BLOCO B CONDOMINIO ED"). Not reliable on its own — see §3. |
| 5 | Referência | reference_raw | Often the building/condominium name ("COND MAISON BLANCHE", "ED POESIA"), sometimes a continuation of column 4. |
| 6 | CEP | cep | Numeric, zero-pad to 8. |
| 7 | Natureza de Transação | nature | "1.Compra e venda", "2.Cessão de direitos…", "17.Resolução da alienação fiduciária…", "20.Realização ou integralização de capital", etc. Parse the leading code. |
| 8 | Valor de Transação (declarado pelo contribuinte) | value | BRL float → integer cents. |
| 9 | Data de Transação | transaction_date | Date of the deed/private instrument. Can be earlier than the file year (late ITBI payments). |
| 10 | Valor Venal de Referência | reference_value | Never published per unit. |
| 11 | Proporção Transmitida (%) | proportion_pct | Percent (0–999.99): 100 = whole property; 0.64 means 0.64%. |
| 12 | Valor Venal de Referência (proporcional) | reference_value_prop | |
| 13 | Base de Cálculo adotada | tax_base | max(value, reference_value_prop) |
| 14 | Tipo de Financiamento | financing_type | e.g. "1.Sistema Financeiro de Habitação"; blank = no financing declared. |
| 15 | Valor Financiado | financed_value | |
| 16 | Cartório de Registro | registry_office | Never published. |
| 17 | Matrícula do Imóvel | registry_number | Never published (identifies the property). |
| 18 | Situação do SQL | sql_status | "Ativo Predial", etc. |
| 19 | Área do Terreno (m2) | land_area_m2 | For condo units this is the whole lot. |
| 20 | Testada (m) | frontage_m | |
| 21 | Fração Ideal | ideal_fraction | 1.0 when not in a condominium. |
| 22 | Área Construída (m2) | built_area_m2 | For condo units it INCLUDES the unit's share of common areas, so it is larger than the private area used in listings. |
| 23 | Uso (IPTU) | use_code | See Tabela de USOS. |
| 24 | Descrição do uso (IPTU) | use_desc | |
| 25 | Padrão (IPTU) | standard_code | See Tabela de PADRÕES (20–25 residential vertical, 10–15 residential horizontal). |

Columns 26+ differ by vintage:
- 2019–2024 files: column 26 is headed "ACC (IPTU)" but actually holds the standard description ("RESIDENCIAL VERTICAL"); column 27 is a second "ACC (IPTU)" holding the construction year.
- 2025–2026 files: column 26 "Descrição do pardão (IPTU)" (sic) is the standard description; column 27 "ACC (IPTU)" is the construction year; there is an empty trailing column.
Write one explicit `ColumnMap` per vintage, assert the headers you expect at each position, and fail loudly if a new file doesn't match.

## 3. Ingestion, cleaning and location
- Build an `integrations/itbi` port with `LocalFileItbiSource` (reads the folder above) and `HttpItbiSource` (URL list from settings, behind a flag; not needed now). CLI: `uv run python -m app.workers.itbi ingest --city sao-paulo --path data/raw/itbi/sao-paulo`; also an arq job for the monthly refresh.
- Raw rows go to `itbi_transactions_raw` (immutable: source file, tab, row number, row hash). Ingestion is idempotent on the row hash, and transactions are deduplicated across files on (sql, transaction_date, value).
- Cleaned rows go to `itbi_transactions` with: nature code 1 only, proportion_pct = 100, value > 0, built_area_m2 > 0, and a normalized `property_kind`: apartment (use 20), flat (use 25, kept separate), house (uses 10, 14). Exclude parking units (23, 24, 63), commercial and land. Flag (don't drop) rows whose unit text mentions bundled parking.
- Quality flags, excluded from medians but kept: value < 50% of reference_value_prop (likely under-declared), price per built m² outside p1–p99 per neighborhood × kind × year.
- Money in integer cents; dates as date. Log every exclusion reason with counts per file and tab.
- Location (the Bairro column can't be trusted):
  1. Neighborhood: build a CEP → neighborhood map by majority vote over rows where `neighborhood_raw` is filled and maps to a known alias; assign the remaining rows by their CEP. Unresolved rows go to a review report with counts by CEP and street.
  2. Districts: if `data/raw/geosampa/` contains the GeoSampa fiscal block layer and the district layer, also assign the official district via setor+quadra (from the SQL) → block centroid → district polygon, with PostGIS. If those files are not there, skip this step and list it as a follow-up; don't block the milestone.
- Report the share of cleaned rows with an assigned neighborhood; target ≥ 95% for wave 1 neighborhoods.

## 4. Normalization
- `cities` (slug, name, uf) and `neighborhoods` (city_id, slug, name, zone, aliases[], wave, is_indexable). Seed São Paulo aliases from the raw values you actually see (e.g. "VL MARIANA", "VILA MARIANA"; "INDIANOPOLIS" → Moema; "VL CLEMENTINO"; "ACLIMACAO"), plus the abbreviations VL → Vila, JD → Jardim, PQ → Parque, CHAC → Chácara. "Jardim Paulista" and "Cerqueira César" stay separate neighborhoods (Jardins is only a display grouping).
- Streets: expand R/AV/AL/PC/TV/EST, title-case for display, strip accents for the slug only. `streets` (city_id, neighborhood_id, name, slug).
- Buildings: group by setor + quadra (from the SQL) + street + number. Display name = most frequent cleaned `reference_raw` that looks like a building name (prefixes COND, ED, EDIF, RES, CONDOMINIO), else "Edifício na <rua>, <número>". Store `construction_year` as the mode of ACC.
- Slugs are stable and unique per parent; keep a `slug_redirects` table so a renamed slug 301s.
- Seed wave 1 (indexable now): Vila Mariana, Moema, Aclimação, Vila Clementino, Saúde, Campo Belo, Ipiranga. Everything else renders with noindex until I flip `is_indexable`.

## 5. Aggregates (materialized, rebuilt after each ingestion)
- `neighborhood_stats`, `street_stats`, `building_stats` per (entity, kind, window): windows = last 12 months, last 24 months, and each calendar year back to 2019, all by transaction_date. ITBI is often paid weeks after the deed, so the latest 2 months are incomplete: end rolling windows at the last complete month minus one and show that end date.
- Fields: transaction count, median value, median price per built m², p25/p75 price per built m², median built area, share of purchases with declared financing, median financed share (financed_value / value), most common financing type, median construction year, last transaction month (month only, never the day), refreshed_at.
- Labeling: the price per m² from this source uses IPTU built area, which includes common areas in condominiums. Always call it "R$/m² de área construída (IPTU)" and explain it in a tooltip; never present it as comparable to listing m² or to FipeZAP.
- Monthly series per neighborhood (count + median price/m²) for the chart.
- Neighbor relations: neighborhoods that share a border (start with a hand-written adjacency list for wave 1; PostGIS later).

## 6. Privacy and quality gates (invariants, with tests)
- Never publish an individual transaction, SQL, unit/complement, registry number (matrícula), registry office, reference value per unit, exact date of a single sale, or any value from a group smaller than the threshold. The files contain no names, but address + value per unit would still identify owners.
- Thresholds (config): neighborhood ≥ 30 transactions in 12m; street ≥ 10 in 36m (street pages are extended and re-gated in Milestone SEO-2, docs/PROMPT_SEO_STREET_PAGES.md); building ≥ 3 in all history. Below threshold: the page renders a short "poucos dados" state with links to the parent and neighbors, `noindex,follow`, and is excluded from sitemaps.
- Round published medians to R$ 1.000 and price/m² to R$ 10.
- Every page shows the source ("Fonte: Prefeitura de São Paulo — guias de ITBI") and "Atualizado em dd/MM/yyyy".

## 7. Pages (apps/web, (marketplace) route group, SSR with ISR revalidate on data refresh)
All copy in pt-BR via the message catalog; sentences are templates filled with numbers, no AI text in this milestone.
1. `/preco-m2/sao-paulo` — index of neighborhoods with median price/m² and count (table + simple map later).
2. `/preco-m2/sao-paulo/[bairro]` — hero numbers (median price, R$/m² de área construída, sales in 12m, % bought with financing), 5-year chart, distribution by size (studio/1/2/3+ bedrooms only if derivable; otherwise by area band), top streets by sales (links), buildings with most sales (links), neighbors comparison, CTA to the financing page, lead capture.
3. `/preco-m2/sao-paulo/[bairro]/[rua]` — same structure at street level, buildings on that street, link up to the neighborhood.
4. `/condominio/sao-paulo/[bairro]/[predio]` — sales count, median price and price/m², area range, construction year if present, "quanto vale o meu apartamento?" CTA (owner lead, for later listing acquisition) and "avise-me quando houver unidade à venda" (buyer lead).
5. `/financiamento/sao-paulo/[bairro]` — "Quanto preciso ganhar para comprar na Vila Mariana": uses the neighborhood median value; SAC and Price from core/finance.py; defaults in config: 20% down payment, 360 months, illustrative annual rate from the existing `FINANCING_ILLUSTRATIVE_ANNUAL_RATE_BPS` setting (basis points), max 30% income commitment; user can edit down payment, FGTS, term, property value. Show the real financed share in that neighborhood from ITBI as context ("nas compras de 2026, X% usaram financiamento, cobrindo em média Y% do valor"). Label "Simulação · não é aprovação", show rate/term/down payment and that insurance and fees are excluded (CLAUDE.md §4.5).
- Use only packages/ui components and tokens. There are no mockups for these pages: in your plan, describe the layout of each page in a short wireframe (ASCII is fine) built from existing components, and list any new component (e.g. PriceStatBlock, MonthlySeriesChart, NeighborComparisonTable, LeadAlertForm) with Storybook stories for all states.
- Breadcrumbs everywhere: São Paulo › Bairro › Rua › Prédio.

## 8. Lead capture
- `LeadAlertForm`: name, WhatsApp (E.164), email optional, intent (buy / I own a unit here), consent checkbox for `contact_about_properties` (unchecked by default, required), optional `marketing` consent.
- Writes `people` + `consents` (with source page URL and timestamp) and a new `property_alerts` table (person_id, scope: neighborhood/street/building, scope_id, intent, created_at, status). No outbound message in this milestone; just store and show in an internal admin list.
- Rate-limit and add a honeypot field; no third-party captcha yet.

## 9. SEO plumbing
- `generateMetadata` per template: title and description from data ("Preço do m² na Vila Mariana: R$ X (vendas reais 2026)"), canonical, `robots` from the gate.
- Sitemap index with one sitemap per template, only indexable pages, `lastmod` = refreshed_at.
- Structured data: BreadcrumbList on all; `Dataset` on price pages (name, description, creator = Prefeitura de São Paulo as source, temporalCoverage, spatialCoverage); `Place` for neighborhood/building. No FAQPage unless the questions are real and on the page.
- OpenGraph images generated per page with the headline number.
- Internal links: index → neighborhoods → streets → buildings; neighbors cross-linked; every page links to its financing page.
- Reuse what the repo already has: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` for the Search Console meta tag and the IndexNow setup (`INDEXNOW_ENABLED`, `INDEXNOW_KEY`) to submit pages whose numbers changed after each refresh. `robots.txt` allows these routes and disallows `/app`.
- Any new setting (thresholds, wave 1 flag, ITBI paths) goes into config with a default and is listed in `.env.example`.
- Core Web Vitals: pages must be server-rendered with no client fetch for the main numbers; chart can hydrate.

## 10. Tests
- Backend: column-map parser for both vintages (2019–2024 header quirk and 2025+ layout) with small fabricated fixture workbooks that copy the real headers exactly; zero-padding of SQL and CEP; proportion as percent; filters and exclusion counts; cross-file dedup; outlier and under-declared flags; CEP → neighborhood majority vote and unmapped report; building grouping and name choice; slug stability and redirects; aggregate math; window end date with the 2-month lag; threshold gate; rounding; idempotent re-ingestion. Never commit the real files or extracts of them to tests.
- Frontend: component stories for every state (loading/empty/error/below-threshold); a test that a below-threshold page has `noindex` and is absent from the sitemap; financing numbers match core/finance.py for a fixed case.
- Playwright: open /preco-m2/sao-paulo/vila-mariana with seeded aggregates → navigate to a street → a building → submit the alert form → row exists with consent.

## Process
1. First reply with a plan: migrations, module layout, the result of checking the column map in §2 against every file and tab (header assertions, row counts per tab, share of empty Bairro), page wireframes, new components, and anything in this prompt that conflicts with CLAUDE.md. Wait for my "go".
2. Build in small commits: ingestion → normalization → aggregates → gates → pages → lead capture → SEO plumbing.
3. Run `make check` and report what passed, plus an ingestion report: rows read, kept, excluded by reason, neighborhoods mapped/unmapped, and how many pages per template pass the gate (indexable vs. noindex) for wave 1.
```

---

## Before pasting
- Done: the 8 ITBI files (2019–2026) are in `data/raw/itbi/sao-paulo/`, and `data/raw/` was added to `.gitignore` (≈260 MB, re-downloadable).
- The repo has only `.env.example` (no `.env` yet). Create it with `cp .env.example .env`. The financing rate is already there as `FINANCING_ILLUSTRATIVE_ANNUAL_RATE_BPS=1150` (11,5% a.a.); change it if you want another reference rate.
- Optional, for official districts: download from GeoSampa the fiscal block layer (quadras fiscais) and the district layer (distritos) into `data/raw/geosampa/`. Without them the milestone uses CEP-based neighborhoods only.
- Street pages (stock from the IPTU register, sale and rental pages, new gate) are Milestone SEO-2: `docs/PROMPT_SEO_STREET_PAGES.md`.
- Monthly: replace the 2026 file with the newest version from the Prefeitura page and rerun the ingest.
