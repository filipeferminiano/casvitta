import { afterEach, describe, expect, it } from 'vitest';

import { toValue, track } from './analytics';

type W = Window & { dataLayer?: Record<string, unknown>[] };

afterEach(() => {
  delete (window as W).dataLayer;
});

describe('track()', () => {
  it('pushes { event, ...params } to the GTM dataLayer', () => {
    expect(track({ name: 'signup_step', step: 'creci' })).toBe(true);
    expect((window as W).dataLayer).toEqual([{ event: 'signup_step', step: 'creci' }]);
  });

  it('sends money as reais with BRL', () => {
    track({
      name: 'view_item',
      item_id: 'apto-vila-mariana',
      item_category: 'apartment',
      transaction: 'sale',
      neighborhood: 'Vila Mariana',
      is_demo: true,
      value: toValue(69_000_000),
      currency: 'BRL',
    });
    expect((window as W).dataLayer?.[0]).toMatchObject({ value: 690_000, currency: 'BRL' });
  });
});
