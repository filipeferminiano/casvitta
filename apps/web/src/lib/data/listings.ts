/**
 * Live, authorized marketplace listings for the SEO listing pages (CLAUDE.md §4.1/§4.2): channel
 * marketplace, status live, an unexpired owner authorization for that transaction, a broker with a
 * validated CRECI. Read from GET /v1/public/listings when the "listings" area is live; until then
 * there are none and pages show the zero state. Demo or mock listings are never used here.
 */
import type { components } from '@casvitta/api-client';

import { API_INTERNAL_URL } from '@/lib/api';
import { isLive } from '@/lib/live';

type PublicListing = components['schemas']['PublicListingOut'];

const LISTINGS_REVALIDATE_SECONDS = 300;
export type PublicListingCard = {
  slug: string;
  title: string;
  priceCents: number;
  condoFeeCents: number | null;
  iptuMonthlyCents: number | null;
  specs: string;
  brokerName: string;
  // Required: a card without a validated CRECI is never rendered.
  creciState: string;
  creciNumber: string;
  sponsored: boolean;
  neighborhood: string;
};

const KIND: Record<PublicListing['kind'], string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  studio: 'Studio',
  commercial: 'Sala comercial',
  land: 'Terreno',
};

/** "2 quartos · 68 m² · 1 vaga": only the facts the record has. */
export function specsOf(l: Pick<PublicListing, 'bedrooms' | 'area_m2' | 'parking'>): string {
  const parts: string[] = [];
  if (l.bedrooms != null) parts.push(l.bedrooms === 1 ? '1 quarto' : `${l.bedrooms} quartos`);
  if (l.area_m2 != null) parts.push(`${l.area_m2} m²`);
  if (l.parking != null) parts.push(l.parking === 1 ? '1 vaga' : `${l.parking} vagas`);
  return parts.join(' · ');
}

export function toCard(l: PublicListing): PublicListingCard {
  return {
    slug: l.slug,
    title: l.title ?? `${KIND[l.kind]} · ${l.neighborhood}`,
    priceCents: l.price_cents,
    condoFeeCents: l.condo_fee_cents ?? null,
    iptuMonthlyCents: l.iptu_monthly_cents ?? null,
    specs: specsOf(l),
    brokerName: l.broker.display_name,
    creciState: l.broker.creci_state,
    creciNumber: l.broker.creci_number,
    // Destaques serving decides sponsored slots; the listing itself is never "sponsored".
    sponsored: false,
    neighborhood: l.neighborhood,
  };
}

export async function getLiveListings(filter: {
  transaction: 'sale' | 'rent';
  city: string;
  neighborhood: string;
  street?: string;
}): Promise<PublicListingCard[]> {
  if (!isLive('listings')) return [];
  const query = new URLSearchParams({
    channel: 'marketplace',
    transaction: filter.transaction,
    city: filter.city,
    neighborhood: filter.neighborhood,
  });
  if (filter.street) query.set('street', filter.street);
  const response = await fetch(`${API_INTERNAL_URL}/v1/public/listings?${query}`, {
    next: { revalidate: LISTINGS_REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`listings API ${response.status}`);
  const listings = (await response.json()) as PublicListing[];
  // A card without the responsible broker's CRECI is never rendered (rule 1).
  return listings.map(toCard).filter((c) => c.creciNumber && c.creciState);
}

/** Indexable only with this many live listings of the transaction (SEO-2 §5). */
export const MIN_LISTINGS_INDEXABLE = 3;
/** "Aluguel mediano anunciado" only with this many listings. */
export const MIN_LISTINGS_FOR_MEDIAN = 5;
