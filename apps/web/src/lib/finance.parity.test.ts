/**
 * The financing page recomputes in the browser; it must match apps/api core/finance.py exactly.
 * Vectors are generated from Python and checked there too (tests/test_finance.py).
 */
import { describe, expect, it } from 'vitest';

import vectors from '../../../api/tests/fixtures/finance_vectors.json';
import { computeSimulation } from '@/screens/market/FinancingCalculator';

describe('financing calculator matches core/finance.py', () => {
  it.each(vectors.cases)(
    '$system, price $price_cents, $term_months months, $annual_rate_bps bps',
    (c) => {
      const result = computeSimulation({
        priceCents: c.price_cents,
        downPaymentCents: c.down_payment_cents,
        fgtsCents: c.fgts_cents,
        termMonths: c.term_months,
        annualRateBps: c.annual_rate_bps,
        system: c.system as 'sac' | 'price',
        maxIncomePct: 30,
      });
      expect(result).toEqual({
        principalCents: c.principal_cents,
        firstPaymentCents: c.first_payment_cents,
        minIncomeCents: c.min_income_cents_30pct,
      });
    },
  );
});
