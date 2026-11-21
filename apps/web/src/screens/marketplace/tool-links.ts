/**
 * Entry points into the market-data pages (price per m², valuation, ITBI, financing). Shared by
 * the footer and the home so every public page links into that cluster (site link structure:
 * home → section → page). São Paulo is the only city with data so far.
 */
export const MARKET_CITY = 'sao-paulo';

export const TOOL_LINKS = [
  { key: 'priceM2', href: `/preco-m2/${MARKET_CITY}` },
  { key: 'valuation', href: '/quanto-vale-meu-imovel' },
  { key: 'itbi', href: `/itbi/${MARKET_CITY}` },
  { key: 'simulate', href: '/#simulador' },
] as const;
