import { describe, expect, it } from 'vitest';

import { CATALOG, PLANS, annualPrice, firstPlanWith, hasFeature, limitOf, planOf } from './catalog';

describe('plan catalog snapshot (CRM-0)', () => {
  it('has the five plans in ladder order with the catalog prices', () => {
    expect(PLANS.map((p) => [p.key, p.monthly_cents])).toEqual([
      ['free', 0],
      ['essential', 4_900],
      ['automation', 14_900],
      ['pro', 29_900],
      ['agency', 49_900],
    ]);
    expect(planOf('agency').price_from).toBe(true);
  });

  it('reads limits and features from the snapshot only', () => {
    expect(limitOf('free', 'active_properties')).toBe(5);
    expect(limitOf('pro', 'crm_contacts')).toBeNull(); // ilimitado
    expect(hasFeature('essential', 'unbranded_page')).toBe(true);
    expect(hasFeature('essential', 'custom_domain')).toBe(false);
    expect(firstPlanWith('custom_domain')?.key).toBe('automation');
    expect(firstPlanWith('distribution_and_permissions')?.key).toBe('agency');
  });

  it('keeps annual prices hidden until they are turned on', () => {
    expect(CATALOG.show_annual_prices).toBe(false);
    expect(annualPrice(planOf('essential'))).toBeNull();
    expect(planOf('essential').annual_monthly_cents).toBe(4_100);
  });

  it('carries Destaques and owner packages', () => {
    expect(CATALOG.highlight_packages).toEqual([
      { days: 7, price_cents: 3_900 },
      { days: 30, price_cents: 11_900 },
    ]);
    expect(CATALOG.owner_packages.map((p) => p.days)).toEqual([30, 90]);
  });
});
