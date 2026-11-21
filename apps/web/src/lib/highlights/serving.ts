/**
 * Destaques serving rules (docs/prompts/PROMPT_DESTAQUES_BUILD.md §4, mockup 45). Pure and
 * deterministic so the search page renders the same slots on the server and in tests.
 *
 * - A property is sponsored only while its Destaque campaign is delivering (never from an Ads
 *   Studio Meta/Google campaign).
 * - Sponsored cards appear only in searches whose filters the property matches: callers pass the
 *   already-filtered results, so a non-matching property can never take a slot.
 * - At most `maxSponsoredPerPage` slots, at fixed positions, one card per advertiser per page.
 * - Rotation is controlled: eligible campaigns are ordered by a hash of (seed, campaign), where the
 *   seed is the search plus the São Paulo day, so it changes between searches and days but stays
 *   stable while a visitor pages through the same search.
 * - Per-visitor frequency (3 per day) and advertiser share of a region (30 %) need impression data
 *   and are enforced by the API serving endpoint, not here.
 */
import type { HighlightCampaign, ID } from '@/domain/types';

export type ServingRules = {
  maxSponsoredPerPage: number;
  /** Zero-based positions of the sponsored slots in a results page. */
  slotPositions: number[];
  maxExposuresPerVisitorPerDay: number;
  maxAdvertiserShareOfRegion: number;
};

export function isDelivering(campaign: HighlightCampaign): boolean {
  return campaign.delivery === 'active';
}

/** The delivering campaign of a property, if any. */
export function activeHighlightFor(
  propertyId: ID,
  campaigns: HighlightCampaign[],
): HighlightCampaign | null {
  return campaigns.find((c) => c.propertyId === propertyId && isDelivering(c)) ?? null;
}

/** FNV-1a, 32 bits: a stable, cheap rotation key. */
export function rotationKey(seed: string, id: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${seed}|${id}`) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export type Placed<T> = T & { sponsored: boolean; highlightCampaignId: string | null };

/**
 * Place sponsored cards into an organic results list. Items that win a slot are labeled and move
 * to the slot (never shown twice); eligible items that do not win keep their organic position,
 * unlabeled.
 */
export function placeSponsored<T>(
  organic: T[],
  keyOf: (item: T) => { propertyId: ID; advertiserId: ID },
  campaigns: HighlightCampaign[],
  rules: ServingRules,
  seed: string,
): Placed<T>[] {
  const eligible = organic
    .map((item) => ({ item, campaign: activeHighlightFor(keyOf(item).propertyId, campaigns) }))
    .filter((e): e is { item: T; campaign: HighlightCampaign } => e.campaign !== null)
    .sort((a, b) => rotationKey(seed, a.campaign.id) - rotationKey(seed, b.campaign.id));

  const slots = rules.slotPositions.slice(0, rules.maxSponsoredPerPage);
  const winners: { item: T; campaign: HighlightCampaign }[] = [];
  const advertisers = new Set<ID>();
  for (const entry of eligible) {
    if (winners.length === slots.length) break;
    const { advertiserId } = keyOf(entry.item);
    if (advertisers.has(advertiserId)) continue;
    advertisers.add(advertiserId);
    winners.push(entry);
  }

  const won = new Set(winners.map((w) => w.item));
  const result: Placed<T>[] = organic
    .filter((item) => !won.has(item))
    .map((item) => ({ ...item, sponsored: false, highlightCampaignId: null }));
  winners.forEach((winner, index) => {
    const position = Math.min(slots[index]!, result.length);
    result.splice(position, 0, {
      ...winner.item,
      sponsored: true,
      highlightCampaignId: winner.campaign.id,
    });
  });
  return result;
}
