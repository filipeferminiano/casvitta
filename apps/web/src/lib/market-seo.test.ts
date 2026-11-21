/**
 * Price pages and search engines: a page below its privacy threshold is noindex (links followed)
 * and never appears in a sitemap. Uses the fabricated demo export (mocks/market-demo.json).
 */
import { describe, expect, it } from 'vitest';

import type { NeighborhoodPage, Sitemap } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { marketUrlset, sitemapIndex, sitemapPaths } from '@/lib/sitemap-xml';
import demo from '@/mocks/market-demo.json';

const pages = demo as unknown as Record<string, unknown>;
const ORIGIN = 'https://casvitta.com.br';

describe('below-threshold pages', () => {
  const below = pages['sao-paulo/aclimacao'] as NeighborhoodPage;
  const above = pages['sao-paulo/vila-mariana'] as NeighborhoodPage;

  it('come from the API without numbers and not indexable', () => {
    expect(below.gate).toMatchObject({ passes: false, indexable: false });
    expect(below.stats).toBeNull();
    expect(above.gate).toMatchObject({ passes: true, indexable: true });
  });

  it('render noindex, follow', () => {
    const meta = marketMetadata({
      title: 'x',
      description: 'y',
      path: below.neighborhood.path,
      indexable: below.gate.indexable,
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(
      marketMetadata({ title: 'x', description: 'y', path: '/', indexable: true }).robots,
    ).toEqual({ index: true, follow: true });
  });

  it('are absent from the sitemaps', () => {
    const bairros = marketUrlset(ORIGIN, pages['sao-paulo/sitemaps/bairros'] as Sitemap);
    expect(bairros).toContain(`${ORIGIN}/preco-m2/sao-paulo/vila-mariana</loc>`);
    expect(bairros).not.toContain('aclimacao');
    const buildings = marketUrlset(ORIGIN, pages['sao-paulo/sitemaps/condominios'] as Sitemap);
    expect(buildings).toContain('condominio-jardim-exemplo');
    expect(buildings).not.toContain('poucos-dados');
  });
});

describe('sitemap index', () => {
  it('lists the static pages and one sitemap per template', () => {
    expect(sitemapPaths()).toEqual([
      '/sitemaps/paginas.xml',
      '/sitemaps/sao-paulo/bairros.xml',
      '/sitemaps/sao-paulo/ruas.xml',
      '/sitemaps/sao-paulo/condominios.xml',
      '/sitemaps/sao-paulo/financiamento.xml',
      '/sitemaps/sao-paulo/avaliacao.xml',
      '/sitemaps/sao-paulo/itbi.xml',
      '/sitemaps/sao-paulo/imoveis.xml',
    ]);
    const xml = sitemapIndex(ORIGIN);
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain(`<loc>${ORIGIN}/sitemaps/sao-paulo/ruas.xml</loc>`);
  });

  it('escapes URLs and writes lastmod', () => {
    const xml = marketUrlset(ORIGIN, {
      template: 'ruas',
      entries: [{ path: '/a?b=1&c=2', last_modified: '2026-11-20T12:00:00Z' }],
    });
    expect(xml).toContain('<loc>https://casvitta.com.br/a?b=1&amp;c=2</loc>');
    expect(xml).toContain('<lastmod>2026-11-20T12:00:00.000Z</lastmod>');
  });
});
