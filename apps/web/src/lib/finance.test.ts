import { describe, expect, it } from 'vitest';

import { priceInstallment, sacFirstInstallment, simulateSac } from './finance';

describe('finance (mirrors apps/api core/finance.py)', () => {
  it('matches the mockups: R$ 552.000 at 11,5% a.a., 360 months -> R$ 6.563 (29,8% of R$ 22 mil)', () => {
    const sim = simulateSac({
      priceCents: 69_000_000,
      downPaymentCents: 13_800_000,
      householdIncomeCents: 2_200_000,
    });
    expect(sim.principalCents).toBe(55_200_000);
    expect(Math.round(sim.firstInstallmentCents / 100)).toBe(6_563);
    expect(sim.incomeShare?.toFixed(3)).toBe('0.298');
  });

  it('matches the lead detail: proposal R$ 672 mil with R$ 138 mil down -> R$ 6.349', () => {
    expect(Math.round(sacFirstInstallment(53_400_000, 1_150, 360) / 100)).toBe(6_349);
  });

  it('price table textbook value', () => {
    // R$ 1.000 at 12,68% a.a. effective (≈1% a.m.), 12 months -> ≈ R$ 88,85
    expect(priceInstallment(100_000, 1_268, 12)).toBeGreaterThan(8_880);
    expect(priceInstallment(100_000, 1_268, 12)).toBeLessThan(8_890);
  });
});
