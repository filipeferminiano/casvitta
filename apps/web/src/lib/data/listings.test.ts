import { describe, expect, it } from 'vitest';

import { getLiveListings, specsOf, toCard } from './listings';

const listing = {
  code: 'CV-204',
  slug: 'apartamento-rua-domingos-de-morais-vila-mariana-cv-204',
  kind: 'apartment',
  transaction: 'sale',
  title: null,
  description: null,
  street: null,
  neighborhood: 'Vila Mariana',
  city: 'São Paulo',
  state: 'SP',
  area_m2: 68,
  bedrooms: 2,
  bathrooms: null,
  parking: 1,
  features: [],
  price_cents: 69_000_000,
  condo_fee_cents: 82_000,
  iptu_monthly_cents: null,
  photos: [],
  broker: {
    display_name: 'Ana Ribeiro',
    slug: 'anaribeiro',
    creci_state: 'SP',
    creci_number: '000.000-F',
    photo_url: null,
  },
  published_at: null,
} as const;

describe('public listings (L-1)', () => {
  it('maps the API record to a card without inventing facts', () => {
    const card = toCard(structuredClone(listing) as never);
    expect(card).toMatchObject({
      title: 'Apartamento · Vila Mariana',
      specs: '2 quartos · 68 m² · 1 vaga',
      iptuMonthlyCents: null, // "Não informado", never 0
      creciNumber: '000.000-F',
      sponsored: false,
    });
    expect(specsOf({ bedrooms: null, area_m2: 40, parking: null })).toBe('40 m²');
  });

  it('shows no listings until the "listings" area is live', async () => {
    expect(
      await getLiveListings({
        transaction: 'sale',
        city: 'sao-paulo',
        neighborhood: 'vila-mariana',
      }),
    ).toEqual([]);
  });
});
