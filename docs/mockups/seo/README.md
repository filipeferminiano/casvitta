# Mockups — programmatic SEO pages (São Paulo)

Approved designs for the public SEO pages, exported from the Casvitta design canvas (page "Páginas SEO"). One folder per page type. Each folder has `desktop` (1440 px), `mobile` (390 px) and `states-components` (every state from the brief plus callouts for new components), as `.png` (what it should look like) and `.html` (exact markup, inline styles and pt-BR copy).

How to use them: the same rules as `docs/mockups/README.md`.
- Rebuild with `packages/ui` components and tokens; never paste inline styles or hex values.
- Numbers, names and listings are examples. The yellow "Demonstrativo" badge exists only because the numbers are fake: in the app it appears only when `SourceInfo.is_demo` is true.
- The header and footer in these mockups are simplified. Use the site's existing header and footer.
- If a mockup conflicts with CLAUDE.md, DESIGN_SYSTEM.md or a data/privacy rule, the docs win; flag it.

| Folder | Page type | URL | Files |
|---|---|---|---|
| `00-overview` | Map of page types, URLs, internal links, shared rules, LeadAlertForm states | — | overview |
| `01-valuation` | Quanto vale meu imóvel (valuation tool) | `/quanto-vale-meu-imovel`, `/quanto-vale-meu-imovel/sao-paulo/[bairro]` | desktop, mobile, states-components |
| `02-itbi-calculator` | Calcular ITBI | `/itbi/sao-paulo` | desktop, mobile, states-components |
| `03-building` | Página do prédio | `/condominio/sao-paulo/[bairro]/[predio]` | desktop, mobile, states-components |
| `04-neighborhood-price` | Preço do m² por bairro + city index | `/preco-m2/sao-paulo/[bairro]`, `/preco-m2/sao-paulo` | desktop, mobile, city-index-desktop, states-components |
| `05-financing` | Quanto preciso ganhar | `/financiamento/sao-paulo/[bairro]` | desktop, mobile, states-components |
| `06-street` | Página da rua + long-street parent | `/rua/sao-paulo/[bairro]/[rua]`, `/rua/sao-paulo/[rua]` | desktop, mobile, parent-street-desktop, states-components |
| `07-listings` | Imóveis à venda / para alugar | `/imoveis/[venda\|aluguel]/sao-paulo/[bairro]` and `/[rua]` | desktop, mobile, states-components |

Not designed yet: neighborhood guide (`/bairros/sao-paulo/[bairro]`), marked "later" in `docs/PROMPT_DESIGN_SEO_PAGES.md`.

Build instructions: `docs/prompts/PROMPT_SEO_PAGES_BUILD.md` (Milestone SEO-3).
