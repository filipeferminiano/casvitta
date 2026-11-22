import { describe, expect, it } from 'vitest';

import { BUDGETS, matchProperties, type FinderAnswers } from './PageForms';
import type { StorefrontProperty } from './Storefront';

const base: StorefrontProperty = {
  code: 'CV-204',
  slug: 'cv-204',
  kind: 'apartment',
  transaction: 'sale',
  title: null,
  neighborhood: 'Cambuí',
  city: 'Campinas',
  price_cents: 78_000_000,
  area_m2: 92,
  bedrooms: 3,
  suites: 1,
  parking: 2,
  photos: [],
};
const house = {
  ...base,
  code: 'CV-318',
  kind: 'house',
  neighborhood: 'Swiss Park',
  price_cents: 125_000_000,
};
const rent = {
  ...base,
  code: 'CV-127',
  transaction: 'rent' as const,
  neighborhood: 'Taquaral',
  price_cents: 280_000,
  bedrooms: 2,
};
const all = [base, house, rent];
const none: FinderAnswers = {
  purpose: null,
  neighborhoods: [],
  budget: null,
  minBedrooms: null,
  kinds: [],
};
const codes = (a: Partial<FinderAnswers>) =>
  matchProperties(all, { ...none, ...a }).map((p) => p.code);

describe('finder matching', () => {
  it('filters by purpose, place, budget, bedrooms and kind', () => {
    expect(codes({ purpose: 'buy' })).toEqual(['CV-204', 'CV-318']);
    expect(codes({ purpose: 'rent' })).toEqual(['CV-127']);
    expect(codes({ purpose: 'buy', budget: 1 })).toEqual(['CV-204']); // R$ 600–900 mil
    expect(codes({ purpose: 'buy', neighborhoods: ['Swiss Park'] })).toEqual(['CV-318']);
    expect(codes({ purpose: 'buy', minBedrooms: 4 })).toEqual([]);
    expect(codes({ purpose: 'buy', kinds: ['house'] })).toEqual(['CV-318']);
    expect(codes({ purpose: 'rent', budget: 1 })).toEqual(['CV-127']); // R$ 2.000–3.500
  });

  it('keeps budgets in integer cents', () => {
    for (const ranges of Object.values(BUDGETS))
      for (const [low, high] of ranges)
        for (const v of [low, high]) if (v != null) expect(Number.isInteger(v)).toBe(true);
  });
});
