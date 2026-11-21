import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type * as SiteConfig from '@/config/site';

import messages from '../../../messages/pt-BR.json';

import { AgenciesScreen } from './AgenciesScreen';
import { BrokersScreen } from './BrokersScreen';
import { OwnersScreen } from './OwnersScreen';

// A catalog that differs from every default, so any hard-coded price would show up.
vi.mock('@/config/site', async (importOriginal) => {
  const original = await importOriginal<typeof SiteConfig>();
  return {
    ...original,
    OFFERS: {
      ownerPacks: [
        { key: '30d', days: 30, priceCents: 7_700 },
        { key: '90d', days: 90, priceCents: 19_900 },
      ],
      brokerPlan: { key: 'corretor', priceCents: 12_300, maxUsers: 2, maxActiveProperties: 70 },
      agencyPlans: [
        { key: 'essencial', priceCents: 33_300, maxUsers: 6, maxActiveProperties: 250 },
        { key: 'equipe', priceCents: 55_500, maxUsers: 20, maxActiveProperties: 600 },
        { key: 'operacao', priceCents: null, maxUsers: null, maxActiveProperties: null },
      ],
      // Even when a highlight price exists in config, these pages never print it.
      highlight: { priceCents: 4_321 },
    },
  };
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const renderIt = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      {ui}
    </NextIntlClientProvider>,
  );

/** Visible text plus the JSON-LD, without the NBSP that Intl puts after "R$". */
const textOf = (container: HTMLElement) => container.textContent!.replace(/\u00a0/g, ' ');

const jsonLd = (container: HTMLElement) =>
  JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML) as {
    '@graph': { '@type': string; offers?: { price: string }; mainEntity?: unknown[] }[];
  };

const DEFAULTS = ['R$ 59', 'R$ 149', 'R$ 99', 'R$ 299', 'R$ 499', 'R$ 197', 'R$ 397'];

describe('audience pages read every price and limit from config', () => {
  it('owners page', () => {
    const { container } = renderIt(<OwnersScreen />);
    const text = textOf(container);
    expect(text).toContain('R$ 77');
    expect(text).toContain('R$ 199');
    expect(text).toContain('30 dias por R$ 77 ou 90 dias por R$ 199');
    for (const price of DEFAULTS)
      expect(text).not.toMatch(new RegExp(`${price.replace('$', '\\$')}\\b`));
    expect(text).not.toContain('43,21');
    const products = jsonLd(container)['@graph'].filter((n) => n['@type'] === 'Product');
    expect(products.map((p) => p.offers!.price)).toEqual(['77.00', '199.00']);
  });

  it('brokers page', () => {
    const { container } = renderIt(<BrokersScreen />);
    const text = textOf(container);
    expect(text).toContain('R$ 123');
    expect(text).toContain('Até 70 imóveis ativos');
    expect(text).toContain('2 usuários');
    expect(text).toContain('até o limite de 70 imóveis ativos'); // FAQ answer
    for (const price of DEFAULTS)
      expect(text).not.toMatch(new RegExp(`${price.replace('$', '\\$')}\\b`));
    expect(text).not.toContain('43,21');
    expect(container.querySelector('a[href="/cadastro/conta?plano=corretor"]')).not.toBeNull();
    const products = jsonLd(container)['@graph'].filter((n) => n['@type'] === 'Product');
    expect(products.map((p) => p.offers!.price)).toEqual(['123.00']);
  });

  it('agencies page: priced plans from config, "Sob consulta" never as a number', () => {
    const { container } = renderIt(<AgenciesScreen />);
    const text = textOf(container);
    expect(text).toContain('R$ 333');
    expect(text).toContain('R$ 555');
    expect(text).toContain('até 250');
    expect(text).toContain('Sob consulta');
    expect(text).toContain('Até 250 imóveis e 6 usuários, o Essencial atende'); // FAQ answer
    for (const price of DEFAULTS)
      expect(text).not.toMatch(new RegExp(`${price.replace('$', '\\$')}\\b`));
    expect(text).not.toContain('43,21');
    const graph = jsonLd(container)['@graph'];
    // Operação maior ("Sob consulta") and the highlight have no Product/Offer.
    expect(graph.filter((n) => n['@type'] === 'Product').map((p) => p.offers!.price)).toEqual([
      '333.00',
      '555.00',
    ]);
    expect(graph.find((n) => n['@type'] === 'FAQPage')!.mainEntity).toHaveLength(6);
  });
});
