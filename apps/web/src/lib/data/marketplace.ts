/**
 * Public read models (marketplace, landing pages). Server components call these directly; they
 * read the pristine fixtures on the server, so pages render with real HTML for SEO.
 */
import type { AvailabilitySlot, BrokerProfile, Campaign, Property } from '@/domain/types';
import { now } from '@/mocks/clock';

import { isPublishable } from './ads';
import { db, mutate } from './store';

export type PublicListing = {
  property: Property;
  broker: BrokerProfile;
  sponsored: boolean;
  campaign: Campaign | null;
};

export function getListingBySlug(slug: string): PublicListing | null {
  const data = db();
  const property = data.properties.find((p) => p.slug === slug);
  // Unauthorized properties are never public (CLAUDE.md §4.2).
  if (!property || !isPublishable(property)) return null;
  const campaign =
    data.campaigns.find((c) => c.propertyId === property.id && c.status === 'live') ?? null;
  return { property, broker: data.broker, sponsored: Boolean(campaign), campaign };
}

export function getBrokerPage(
  slug: string,
): { broker: BrokerProfile; properties: Property[] } | null {
  const data = db();
  if (data.broker.slug !== slug) return null;
  return { broker: data.broker, properties: data.properties.filter(isPublishable) };
}

/** Next free slots the assistant offers to buyers (two, on the first day that has them). */
export function offeredSlots(): AvailabilitySlot[] {
  const data = db();
  const taken = new Set(data.appointments.map((a) => a.startsAt));
  const free = data.slots
    .filter(
      (s) => s.kind === 'free_for_ai' && new Date(s.startsAt) > now() && !taken.has(s.startsAt),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const saturday = free.filter((s) => new Date(s.startsAt).getUTCDay() === 6);
  return (saturday.length >= 2 ? saturday : free).slice(0, 2);
}

/** Buyer picks a slot in the marketplace chat (demo: stored for the confirmation page). */
export async function pickBuyerSlot(propertySlug: string, slotStartsAt: string): Promise<void> {
  mutate((data) => {
    data.buyerVisits[propertySlug] = slotStartsAt;
  });
}

export function getBuyerVisit(propertySlug: string): string | null {
  return db().buyerVisits[propertySlug] ?? null;
}
