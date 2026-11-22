import { expect, test } from '@playwright/test';

/**
 * Site link structure: every public page type must be reachable from the home by following
 * links, within a maximum number of clicks (home → section → page → detail). Fails when a section
 * loses its way in, as the market-data pages once did (reachable only through the sitemap).
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const origin = `http://localhost:${port}`;

test.skip(({ isMobile }) => isMobile, 'links are the same on every viewport');

/** Collapse concrete URLs into page types ("/preco-m2/sao-paulo/vila-mariana" → "/preco-m2/[c]/[b]"). */
const PAGE_TYPES: [RegExp, string][] = [
  [/^\/imovel\/[^/]+\/conversa$/, '/imovel/[slug]/conversa'],
  [/^\/imovel\/[^/]+\/visita-confirmada$/, '/imovel/[slug]/visita-confirmada'],
  [/^\/imovel\/[^/]+$/, '/imovel/[slug]'],
  [/^\/imoveis\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/, '/imoveis/[t]/[c]/[b]/[rua]'],
  [/^\/imoveis\/[^/]+\/[^/]+\/[^/]+$/, '/imoveis/[t]/[c]/[b]'],
  [/^\/imoveis\/[^/]+\/[^/]+$/, '/imoveis/[t]/[c]'],
  [/^\/condominio\/.+/, '/condominio/[c]/[b]/[predio]'],
  [/^\/financiamento\/.+/, '/financiamento/[c]/[b]'],
  [/^\/itbi\/.+/, '/itbi/[c]'],
  [/^\/preco-m2\/[^/]+\/[^/]+$/, '/preco-m2/[c]/[b]'],
  [/^\/preco-m2\/[^/]+$/, '/preco-m2/[c]'],
  [/^\/quanto-vale-meu-imovel\/.+/, '/quanto-vale-meu-imovel/[c]/[b]'],
  [/^\/rua\/.+/, '/rua/[c]/[b]/[rua]'],
  [/^\/cadastro.*/, '/cadastro'],
];
const pageType = (path: string) => PAGE_TYPES.find(([re]) => re.test(path))?.[1] ?? path;

/** Maximum clicks from the home for each page type. */
const MAX_DEPTH: Record<string, number> = {
  '/comprar': 1,
  '/alugar': 1,
  '/anunciar-imovel': 1,
  '/para-corretores': 1,
  '/para-imobiliarias': 1,
  '/precos': 1,
  '/preco-m2/[c]': 1,
  '/quanto-vale-meu-imovel': 1,
  '/itbi/[c]': 1,
  '/investidores': 1,
  '/incorporadoras': 1,
  '/leilao': 1,
  '/anunciar-imovel/corretor': 1,
  // Header menus and footer (docs/mockups/navigation).
  '/mapa-do-site': 1,
  '/imoveis/[t]/[c]': 1,
  '/imovel/[slug]': 1,
  '/cadastro': 2,
  '/preco-m2/[c]/[b]': 1,
  '/imoveis/[t]/[c]/[b]': 2,
  '/quanto-vale-meu-imovel/[c]/[b]': 1,
  '/financiamento/[c]/[b]': 2,
  '/rua/[c]/[b]/[rua]': 3,
  '/condominio/[c]/[b]/[predio]': 3,
  '/imoveis/[t]/[c]/[b]/[rua]': 3,
};
const DEEPEST = Math.max(...Object.values(MAX_DEPTH));

test('every public page type is reachable from the home within its click budget', async ({
  request,
}) => {
  test.setTimeout(180_000);
  const depth = new Map<string, number>();
  const queue: [string, number][] = [['/', 0]];
  while (queue.length) {
    const [path, d] = queue.shift()!;
    const type = pageType(path);
    if (depth.has(type)) continue;
    depth.set(type, d);
    if (d >= DEEPEST) continue;
    const response = await request.get(`${origin}${path}`);
    if (!response.ok()) continue;
    const html = await response.text();
    for (const [, href = ''] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      if (!href || /^\/(_next|api|og)\b/.test(href) || href.split('/').pop()!.includes('.'))
        continue;
      const next = href.replace(/\/$/, '') || '/';
      if (!depth.has(pageType(next))) queue.push([next, d + 1]);
    }
  }

  const problems = Object.entries(MAX_DEPTH)
    .filter(([type, max]) => !depth.has(type) || depth.get(type)! > max)
    .map(
      ([type, max]) =>
        `${type}: ${depth.has(type) ? `${depth.get(type)} clicks` : 'unreachable'} (max ${max})`,
    );
  expect(problems, problems.join('\n')).toEqual([]);
});
