/** One public listing from the API (casvitta.com.br/imovel/{slug}), server-side. */
import type { components } from '@casvitta/api-client';

import { API_INTERNAL_URL } from '@/lib/api';

export type LiveListing = components['schemas']['PublicListingOut'];

export async function getLiveListing(slug: string): Promise<LiveListing | null> {
  const response = await fetch(
    `${API_INTERNAL_URL}/v1/public/listings/${encodeURIComponent(slug)}`,
    { next: { revalidate: 120 } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`listing API ${response.status}`);
  return (await response.json()) as LiveListing;
}
