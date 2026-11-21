/**
 * Live, authorized marketplace listings for the SEO listing pages (CLAUDE.md §4.1/§4.2): channel
 * marketplace, status live, an unexpired owner authorization for that transaction, a broker with a
 * validated CRECI. The API has no listings domain yet, so there are none: pages show the zero
 * state. Demo or mock listings are never used here.
 */
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

export async function getLiveListings(_filter: {
  transaction: 'sale' | 'rent';
  city: string;
  neighborhood: string;
  street?: string;
}): Promise<PublicListingCard[]> {
  return [];
}

/** Indexable only with this many live listings of the transaction (SEO-2 §5). */
export const MIN_LISTINGS_INDEXABLE = 3;
/** "Aluguel mediano anunciado" only with this many listings. */
export const MIN_LISTINGS_FOR_MEDIAN = 5;
