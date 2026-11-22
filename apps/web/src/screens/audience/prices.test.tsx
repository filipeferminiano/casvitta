import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type Snapshot from '@casvitta/config/catalog.json';

import messages from '../../../messages/pt-BR.json';

import { AgenciesScreen } from './AgenciesScreen';
import { BrokersScreen } from './BrokersScreen';
import { OwnersScreen } from './OwnersScreen';
import { PricesScreen } from './PricesScreen';

// A catalog that differs from every real value, so any hard-coded price or limit shows up.
vi.mock('@casvitta/config/catalog.json', async (importOriginal) => {
  const original = (await importOriginal<{ default: typeof Snapshot }>()).default;
  const prices: Record<string, number> = {
    free: 0,
    essential: 5_300,
    automation: 15_700,
    pro: 31_100,
    agency: 52_300,
  };
  const catalog = structuredClone(original);
  for (const plan of catalog.plans) {
    plan.monthly_cents = prices[plan.key]!;
    if (plan.key === 'free')
      Object.assign(plan.limits, { active_properties: 7, crm_contacts: 111 });
    if (plan.key === 'agency') {
      plan.extra_user_cents = 6_100;
      Object.assign(plan.limits, { users: 6, active_properties: 1_200 });
    }
  }
  catalog.highlight_packages = [
    { days: 7, price_cents: 4_300 },
    { days: 30, price_cents: 12_700 },
  ];
  catalog.owner_packages = [
    { days: 30, price_cents: 7_700 },
    { days: 90, price_cents: 19_900 },
  ];
  catalog.add_ons = catalog.add_ons.map((a) => ({ ...a, price_cents: a.price_cents + 300 }));
  return { default: catalog };
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

type Node = { '@type': string; offers?: { price: string }; mainEntity?: unknown[] };
const jsonLd = (container: HTMLElement) =>
  JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML) as {
    '@graph': Node[];
  };
const productPrices = (container: HTMLElement) => {
  const graph = jsonLd(container)['@graph'];
  return graph.filter((n) => n['@type'] === 'Product').map((p) => p.offers!.price);
};

/** Real catalog prices (plans, annual, add-ons, Destaques, owner packs) and the old tables. */
const REAL = [
  'R$ 49',
  'R$ 149',
  'R$ 299',
  'R$ 499',
  'R$ 41',
  'R$ 124',
  'R$ 249',
  'R$ 416',
  'R$ 39',
  'R$ 119',
  'R$ 59',
  'R$ 99',
  'R$ 197',
  'R$ 397',
];
const noRealPrices = (text: string) => {
  for (const price of REAL) expect(text).not.toMatch(new RegExp(`${price.replace('$', '\\$')}\\b`));
};

describe('audience pages read every price and limit from the catalog', () => {
  it('owners page', () => {
    const { container } = renderIt(<OwnersScreen />);
    const text = textOf(container);
    expect(text).toContain('30 dias por R$ 77 ou 90 dias por R$ 199');
    noRealPrices(text);
    expect(productPrices(container)).toEqual(['77.00', '199.00']);
  });

  it('brokers page: the five plans, extras and FAQ', () => {
    const { container } = renderIt(<BrokersScreen />);
    const text = textOf(container);
    for (const price of ['R$ 53', 'R$ 157', 'R$ 311', 'R$ 523']) expect(text).toContain(price);
    expect(text).toContain('Plano Grátis com 7 imóveis');
    expect(text).toContain('Grátis: 7 · Essencial: 30');
    expect(text).toContain('7 imóveis publicados e até 111 contatos'); // FAQ answer
    expect(text).toContain('R$ 43 por 7 dias ou R$ 127 por 30 dias');
    expect(text).toContain('6 usuários (+R$ 61 por usuário)');
    expect(text).toContain('Imobiliária a partir de R$ 523');
    noRealPrices(text);
    // Corrections to the mockup: WhatsApp is connected by the team, no Meta charge, no annual.
    expect(text).toContain('WhatsApp conectado pela equipe Casvitta');
    expect(text).not.toContain('24 horas não é cobrado');
    expect(text).not.toMatch(/Anual|meses grátis|para sempre/);
    for (const plan of ['free', 'essential', 'automation', 'pro'])
      expect(container.querySelector(`a[href="/cadastro/conta?plano=${plan}"]`)).not.toBeNull();
    expect(productPrices(container)).toEqual(['53.00', '157.00', '311.00', '523.00']);
  });

  it('prices page: the full table, no FAQPage', () => {
    const { container } = renderIt(<PricesScreen />);
    const text = textOf(container);
    for (const price of ['R$ 53', 'R$ 157', 'R$ 311', 'R$ 523']) expect(text).toContain(price);
    expect(text).toContain('1.200');
    expect(text).toContain('6 (+R$ 61)');
    expect(text).toContain('Destaques avulsos (R$ 43 / R$ 127)');
    expect(text).toContain('R$ 77 por 30 dias ou R$ 199 por 90 dias');
    noRealPrices(text);
    expect(jsonLd(container)['@graph'].some((n) => n['@type'] === 'FAQPage')).toBe(false);
    expect(productPrices(container)).toEqual(['53.00', '157.00', '311.00', '523.00']);
  });

  it('agencies page: the Imobiliária plan from the catalog', () => {
    const { container } = renderIt(<AgenciesScreen />);
    const text = textOf(container);
    expect(text).toContain('R$ 523');
    expect(text).toContain('6 usuários (+R$ 61 por usuário)');
    expect(text).toContain('Mais de 1.200 imóveis');
    expect(text).toContain('a partir de R$ 523 por mês'); // FAQ answer
    noRealPrices(text);
    expect(productPrices(container)).toEqual(['523.00']);
    expect(
      jsonLd(container)['@graph'].find((n) => n['@type'] === 'FAQPage')!.mainEntity,
    ).toHaveLength(6);
  });
});
