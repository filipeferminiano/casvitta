/** The ITBI calculator must match apps/api core/itbi.py (vectors generated from Python). */
import { describe, expect, it } from 'vitest';

import vectors from '../../../api/tests/fixtures/itbi_vectors.json';
import { computeItbi } from '@/lib/itbi';

describe('ITBI calculator matches core/itbi.py', () => {
  it.each(vectors.cases)('price $price_cents, sfh $sfh, limit $sfh_limit_cents', (c) => {
    const result = computeItbi(
      { rate_bps: c.rate_bps, sfh_rate_bps: c.sfh_rate_bps, sfh_limit_cents: c.sfh_limit_cents },
      {
        priceCents: c.price_cents,
        venalCents: c.venal_cents,
        financedCents: c.financed_cents,
        sfh: c.sfh,
      },
    );
    expect(result?.baseCents).toBe(c.base_cents);
    expect(result?.totalCents).toBe(c.total_cents);
    expect(result?.parts.map((p) => [p.kind, p.baseCents, p.taxCents])).toEqual(
      c.parts.map((p) => [p.kind, p.base_cents, p.tax_cents]),
    );
  });

  it('needs a price', () => {
    expect(
      computeItbi({ rate_bps: 300, sfh_rate_bps: 50, sfh_limit_cents: null }, { priceCents: 0 }),
    ).toBeNull();
  });
});
