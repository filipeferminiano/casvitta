/**
 * Auction capture (59–61). The confirmation page shows the criteria just sent; only criteria
 * (no name or phone) are kept in sessionStorage for that, never in the URL.
 */
export const AUCTION_KINDS = ['apartment', 'house', 'land', 'commercial'] as const;
export const AUCTION_PRICE_RANGES = [
  'up_to_300k',
  '300k_to_600k',
  '600k_to_1m',
  'over_1m',
] as const;
export const AUCTION_PAYMENTS = ['cash', 'financing', 'unsure'] as const;

export type AuctionCriteria = {
  regions: string;
  property_kinds: (typeof AUCTION_KINDS)[number][];
  price_range: (typeof AUCTION_PRICE_RANGES)[number];
  payment: (typeof AUCTION_PAYMENTS)[number];
  purpose: 'live' | 'invest';
  has_participated: boolean;
};

const KEY = 'casvitta.auction.criteria';

/** Fictitious criteria for ?demo=1 (shown with "Demonstrativo"). */
export const DEMO_AUCTION_CRITERIA: AuctionCriteria = {
  regions: 'São Paulo · Zona Sul',
  property_kinds: ['apartment', 'house'],
  price_range: '300k_to_600k',
  payment: 'financing',
  purpose: 'live',
  has_participated: false,
};

export function rememberAuctionCriteria(criteria: AuctionCriteria): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(criteria));
}

export function readAuctionCriteria(): AuctionCriteria | null {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuctionCriteria;
  } catch {
    return null;
  }
}
