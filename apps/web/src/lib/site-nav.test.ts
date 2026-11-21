import { describe, expect, it } from 'vitest';

import type { CityIndexPage } from '@/lib/data/market';
import demo from '@/mocks/market-demo.json';

import { whatsappShare } from './share';
import { buildMenus, navHoods, popularSearches, search } from './site-nav';

const index = (demo as unknown as Record<string, CityIndexPage>)['sao-paulo']!;

describe('site navigation model', () => {
  const hoods = navHoods(index);

  it('lists only neighborhoods that pass the threshold, most sales first', () => {
    const indexable = index.neighborhoods.filter((n) => n.indexable).map((n) => n.place.slug);
    expect(hoods.map((h) => h.slug).sort()).toEqual([...indexable].sort());
    expect(hoods.map((h) => h.slug)).not.toContain('aclimacao'); // below threshold in the demo
    const sales = hoods.map(
      (h) => index.neighborhoods.find((n) => n.place.slug === h.slug)!.stats!.sales,
    );
    expect(sales).toEqual([...sales].sort((a, b) => b - a));
  });

  it('builds the five menus, neighborhoods linking to the filtered search', () => {
    const menus = buildMenus(hoods);
    expect(menus.map((m) => m.key)).toEqual(['buy', 'rent', 'sell', 'tools', 'pros']);
    const byHood = menus[0]!.sections.find((s) => s.key === 'byHood')!;
    expect(byHood.links[0]).toMatchObject({
      href: search('sale', { where: hoods[0]!.name }),
      label: { text: hoods[0]!.name },
    });
    expect(byHood.links.at(-1)).toMatchObject({ href: '/imoveis/venda/sao-paulo', more: true });
    expect(search('rent', { kind: 'apartment', where: 'Vila Mariana' })).toBe(
      '/alugar?onde=Vila+Mariana&tipo=apartamento',
    );
  });

  it('keeps the tools but drops neighborhood lists when there is no data', () => {
    const menus = buildMenus([]);
    expect(menus[0]!.sections.map((s) => s.key)).toEqual(['byType', 'beforeBuying']);
    const tools = menus.find((m) => m.key === 'tools')!;
    expect(tools.sections[1]!.links.map((l) => l.id)).toEqual(['city']);
    expect(popularSearches([])).toEqual([]);
  });

  it('marks future modules and never links a below-threshold neighborhood', () => {
    const pros = buildMenus(hoods).find((m) => m.key === 'pros')!;
    expect(pros.sections.flatMap((s) => s.links).find((l) => l.id === 'developers')?.soon).toBe(
      true,
    );
    const hrefs = buildMenus(hoods).flatMap((m) =>
      m.sections.flatMap((s) => s.links.map((l) => l.href)),
    );
    expect(hrefs.join(' ')).not.toMatch(/aclimacao|Aclima/);
  });

  it('shares on WhatsApp without a fixed recipient', () => {
    expect(whatsappShare('Veja: https://casvitta.com.br/itbi/sao-paulo')).toBe(
      'https://wa.me/?text=Veja%3A%20https%3A%2F%2Fcasvitta.com.br%2Fitbi%2Fsao-paulo',
    );
  });
});
