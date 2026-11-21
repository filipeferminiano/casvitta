# Mockups — audience landing pages

Approved designs from the Casvitta design canvas (page "Landing pages por público"). Each folder has `desktop` (1440 px) and `mobile` (390 px) as `.png` and `.html`. Same rules as `docs/mockups/README.md`: rebuild with `packages/ui` and tokens, the HTML is a static reference, the docs win on conflicts.

| Folder | Page | Route |
|---|---|---|
| `00-prices-hypotheses` | Prices and limits used in the pages (hypotheses, centralized) | — |
| `01-owners` | Para proprietários · one-off listing, 30 or 90 days | `/anunciar-imovel` |
| `02-brokers` | Para corretores autônomos · software + portal included | `/para-corretores` |
| `03-agencies` | Para imobiliárias · team plans + demo form | `/para-imobiliarias` |

Product screens inside the pages are illustrative. Photo areas are placeholders until real photos are added. The yellow "Demonstrativo" badge marks the mockups only.

Build prompt: `docs/prompts/PROMPT_LANDING_PAGES_BUILD.md`.

## Update (CRM release)

`02-brokers` (desktop + mobile) and `00-prices-hypotheses` were replaced: the brokers page now sells page + CRM + automations + AI assistant, and prices follow one plan ladder: Grátis · Essencial R$ 49 · Automação R$ 149 · Pro R$ 299 · Imobiliária a partir de R$ 499 (annual = 10 months). `00-prices-hypotheses/prices` is the full feature/limit table. `03-agencies` still shows the old R$ 299/499 plans: align it to the "Imobiliária" plan of the catalog when building. See `docs/prompts/PROMPT_CRM_BUILD.md` §1.
