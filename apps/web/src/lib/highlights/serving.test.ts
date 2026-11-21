import { describe, expect, it } from 'vitest';

import type { HighlightCampaign } from '@/domain/types';

import { activeHighlightFor, placeSponsored, type ServingRules } from './serving';

const RULES: ServingRules = {
  maxSponsoredPerPage: 2,
  slotPositions: [0, 5],
  maxExposuresPerVisitorPerDay: 3,
  maxAdvertiserShareOfRegion: 0.3,
};

const campaign = (id: string, propertyId: string, delivery: HighlightCampaign['delivery']) =>
  ({
    id,
    propertyId,
    advertiserWorkspaceId: 'ws',
    packageDays: 7,
    priceCents: 3_900,
    payment: 'paid',
    review: 'approved',
    delivery,
    plannedStartsOn: '2026-11-18',
    plannedEndsOn: '2026-11-24',
    deliveredDays: 1,
    isDemo: true,
  }) satisfies HighlightCampaign;

type Item = { id: string; ws: string };
const items = (n: number, ws = (i: number) => `ws-${i}`): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, ws: ws(i) }));
const key = (i: Item) => ({ propertyId: i.id, advertiserId: i.ws });

describe('Destaques serving (mockup 45)', () => {
  it('only an active delivery is sponsored (paid, scheduled or paused are not)', () => {
    const list = [
      campaign('A', 'p1', 'scheduled'),
      campaign('B', 'p1', 'paused'),
      campaign('C', 'p2', 'active'),
    ];
    expect(activeHighlightFor('p1', list)).toBeNull();
    expect(activeHighlightFor('p2', list)?.id).toBe('C');
  });

  it('caps at 2 labeled slots per page, at the configured positions, never duplicated', () => {
    const organic = items(10);
    const campaigns = ['p2', 'p4', 'p7', 'p9'].map((p, i) => campaign(`D${i}`, p, 'active'));
    const placed = placeSponsored(organic, key, campaigns, RULES, 'seed');
    expect(placed).toHaveLength(10);
    expect(new Set(placed.map((p) => p.id)).size).toBe(10);
    expect(placed.filter((p) => p.sponsored)).toHaveLength(2);
    expect(placed[0]?.sponsored).toBe(true);
    expect(placed[5]?.sponsored).toBe(true);
  });

  it('never places a property that is not in the filtered results', () => {
    const placed = placeSponsored(items(3), key, [campaign('X', 'other', 'active')], RULES, 's');
    expect(placed.some((p) => p.sponsored)).toBe(false);
  });

  it('one card per advertiser per page', () => {
    const organic = items(8, () => 'same-ws');
    const campaigns = ['p1', 'p3'].map((p, i) => campaign(`E${i}`, p, 'active'));
    const placed = placeSponsored(organic, key, campaigns, RULES, 'seed');
    expect(placed.filter((p) => p.sponsored)).toHaveLength(1);
  });

  it('rotates between searches but is stable for the same search and day', () => {
    const organic = items(10);
    const campaigns = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((p, i) =>
      campaign(`F${i}`, p, 'active'),
    );
    const winners = (seed: string) =>
      placeSponsored(organic, key, campaigns, RULES, seed)
        .filter((p) => p.sponsored)
        .map((p) => p.id)
        .join();
    expect(winners('2026-11-21|a')).toBe(winners('2026-11-21|a'));
    const seen = new Set(Array.from({ length: 20 }, (_, i) => winners(`2026-11-${i}|a`)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('short result lists put the slot at the end instead of leaving a hole', () => {
    const placed = placeSponsored(items(3), key, [campaign('G', 'p2', 'active')], RULES, 's');
    expect(placed.map((p) => p.id)).toEqual(['p2', 'p0', 'p1']);
  });
});
