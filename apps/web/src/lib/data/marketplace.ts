/**
 * Public read models (marketplace, landing pages). Server components call these directly; they
 * read the pristine fixtures on the server, so pages render with real HTML for SEO.
 */
import type {
  AdCreative,
  AvailabilitySlot,
  BrokerProfile,
  Campaign,
  Property,
} from '@/domain/types';
import { HIGHLIGHT_SERVING } from '@/config/site';
import { simulateSac } from '@/lib/finance';
import { placeSponsored, type Placed } from '@/lib/highlights/serving';
import type { SearchFilters } from '@/lib/search-params';
import { now } from '@/mocks/clock';
import { marketBrokers, marketProperties, rentEstimates } from '@/mocks/fixtures';

import { isPublishable } from './ads';
import { db, mutate, newId } from './store';
import { byId } from './views';

export type PublicListing = {
  property: Property;
  broker: BrokerProfile;
  /** Ads Studio (Meta/Google) campaign: attribution only; it never makes a listing sponsored. */
  campaign: Campaign | null;
  /** Approved ad copy (AI-written, shown with "Feito por IA"). */
  creative: AdCreative | null;
};

/** Every property that could be public: the broker's own plus other brokers' inventory. */
function allProperties(): Property[] {
  return [...db().properties, ...marketProperties];
}

function brokerFor(property: Property): BrokerProfile {
  const data = db();
  if (property.workspaceId === data.broker.workspaceId) return data.broker;
  return marketBrokers.find((b) => b.workspaceId === property.workspaceId) ?? data.broker;
}

export function getListingBySlug(slug: string): PublicListing | null {
  const data = db();
  const property = allProperties().find((p) => p.slug === slug);
  // Unauthorized properties are never public (CLAUDE.md §4.2).
  if (!property || !isPublishable(property)) return null;
  const campaign =
    data.campaigns.find((c) => c.propertyId === property.id && c.status === 'live') ?? null;
  const creative = campaign
    ? (data.creatives.find((c) => c.id === campaign.creativeId) ?? null)
    : null;
  return {
    property,
    broker: brokerFor(property),
    campaign,
    creative,
  };
}

/** Every publishable listing (marketplace home, broker page). */
export function listPublicListings(): PublicListing[] {
  return allProperties()
    .filter(isPublishable)
    .map((p) => getListingBySlug(p.slug))
    .filter((l): l is PublicListing => l !== null);
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

/**
 * "Pergunte sobre este imóvel": answers only from the property record (CLAUDE.md §4.4). The fake
 * matches keywords against confirmed facts; anything else goes to the broker. The LLM version in
 * Milestone 2 keeps the same contract: answer + source field, or hand off.
 */
export type RecordAnswer = { kind: 'fact'; text: string; source: string } | { kind: 'handoff' };

const TOPICS: {
  keywords: RegExp;
  answer: (p: Property) => { text: string; source: string } | null;
}[] = [
  {
    keywords: /\b(pet|pets|cachorr|gat|animal)/i,
    answer: (p) => (p.facts.pets ? { text: p.facts.pets, source: 'facts.pets' } : null),
  },
  {
    keywords: /\b(vaga|garagem|carro)/i,
    answer: (p) =>
      p.facts.parking
        ? { text: p.facts.parking, source: 'facts.parking' }
        : { text: `${p.parking}`, source: 'parking' },
  },
  {
    keywords: /\b(condom[ií]nio)/i,
    answer: (p) =>
      p.condoFeeCents ? { text: `${p.condoFeeCents}`, source: 'condo_fee_cents' } : null,
  },
  {
    keywords: /\b(iptu)/i,
    answer: (p) => (p.iptuYearCents ? { text: `${p.iptuYearCents}`, source: 'iptu_cents' } : null),
  },
  {
    keywords: /\b(metr[oô]|esta[cç][aã]o)/i,
    answer: (p) =>
      p.nearby ? { text: `${p.nearby.label}|${p.nearby.distanceM}`, source: 'nearby' } : null,
  },
  {
    keywords: /\b(quarto|dormit)/i,
    answer: (p) => ({ text: `${p.bedrooms}`, source: 'bedrooms' }),
  },
  {
    keywords: /\b(metragem|tamanho|m²|m2|[aá]rea)/i,
    answer: (p) => ({ text: `${p.areaM2}`, source: 'area_m2' }),
  },
];

export function answerFromRecord(property: Property, question: string): RecordAnswer {
  for (const topic of TOPICS) {
    if (topic.keywords.test(question)) {
      const found = topic.answer(property);
      if (found) return { kind: 'fact', ...found };
    }
  }
  return { kind: 'handoff' };
}

/**
 * Buyer picks a slot in the marketplace chat: the visit is booked in the broker's agenda and a
 * lead is created (source marketplace, stage "Visita marcada") with the answers the buyer gave.
 */
export async function bookBuyerVisit(
  propertySlug: string,
  slotId: string,
  answers: {
    financingPct: number | null;
    fgtsCents: number | null;
    householdIncomeCents: number | null;
  },
): Promise<string> {
  return mutate((data) => {
    const property = data.properties.find((p) => p.slug === propertySlug);
    if (!property || !isPublishable(property)) throw new Error('Property not available');
    const slot = byId(data.slots, slotId);
    const at = now().toISOString();
    const personId = newId('person');
    const leadId = newId('lead');
    data.people.push({
      id: personId,
      name: 'Visitante do marketplace',
      phoneE164: '+5511900000000',
      profileLabel: null,
      consents: [{ purpose: 'contact_about_properties', grantedAt: at, source: 'marketplace' }],
    });
    data.leads.push({
      id: leadId,
      workspaceId: property.workspaceId,
      propertyId: property.id,
      personId,
      source: 'marketplace',
      campaignId: null,
      acquisitionCostCents: null,
      stage: 'visit_booked',
      qualification: {
        financingPct: answers.financingPct,
        usesFgts: answers.fgtsCents ? true : null,
        fgtsCents: answers.fgtsCents,
        downPaymentCents: null,
        householdIncomeCents: answers.householdIncomeCents,
        timeframe: null,
      },
      needsHuman: false,
      note: null,
      followUp: null,
      createdAt: at,
      lastActivityAt: at,
      unseen: true,
      isDemo: true,
    });
    data.appointments.push({
      id: newId('appt'),
      kind: 'visit',
      leadId,
      propertyId: property.id,
      startsAt: slot.startsAt,
      status: 'confirmed',
      title: null,
      note: null,
      bookedByAi: true,
      reminders: [],
    });
    data.buyerVisits[propertySlug] = slot.startsAt;
    return slot.startsAt;
  });
}

export function getBuyerVisit(propertySlug: string): string | null {
  return db().buyerVisits[propertySlug] ?? null;
}

// ---------------------------------------------------------------- search (mockup 53)

export const MIN_COMPARABLES = 5;

export type InvestmentEstimate = {
  monthlyRentCents: number;
  comparables: number;
  grossYield: number;
};

export type SearchResult = Placed<PublicListing> & {
  /** First SAC installment with 20% down, 360 months, illustrative rate (sales only). */
  installmentCents: number | null;
  /** Only in "Para investir" mode, and only with ≥ 5 comparables (CLAUDE.md rule 12). */
  estimate: InvestmentEstimate | null;
};

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function investmentEstimate(property: Property): InvestmentEstimate | null {
  const rent = rentEstimates[property.id];
  if (!rent || property.transaction !== 'sale' || rent.comparables < MIN_COMPARABLES) return null;
  return {
    monthlyRentCents: rent.monthlyCents,
    comparables: rent.comparables,
    grossYield: (rent.monthlyCents * 12) / property.priceCents,
  };
}

const saoPauloDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);

export function searchListings(filters: SearchFilters): SearchResult[] {
  const place = filters.where ? fold(filters.where.split(',')[0] ?? '') : null;
  const listings = listPublicListings().filter(({ property: p }) => {
    if (p.transaction !== filters.transaction) return false;
    if (place && !fold(`${p.neighborhood} ${p.street} ${p.city}`).includes(place)) return false;
    if (filters.kind && p.kind !== filters.kind) return false;
    if (filters.maxPriceCents && p.priceCents > filters.maxPriceCents) return false;
    if (filters.minBedrooms && p.bedrooms < filters.minBedrooms) return false;
    if (filters.fgts && !p.features.includes('Aceita FGTS')) return false;
    if (filters.metro && !(p.nearby && /metr/i.test(p.nearby.label) && p.nearby.distanceM <= 1000))
      return false;
    if (filters.pet && !p.facts.pets) return false;
    return true;
  });
  const order: Record<SearchFilters['sort'], (a: PublicListing, b: PublicListing) => number> = {
    relevance: (a, b) => b.property.createdAt.localeCompare(a.property.createdAt),
    newest: (a, b) => b.property.createdAt.localeCompare(a.property.createdAt),
    price_asc: (a, b) => a.property.priceCents - b.property.priceCents,
    price_desc: (a, b) => b.property.priceCents - a.property.priceCents,
  };
  const organic = [...listings].sort(order[filters.sort]);
  // Destaques only: up to 2 labeled slots among results that already match the filters, rotated
  // per search and per São Paulo day (mockup 45).
  const seed = `${saoPauloDay(now())}|${JSON.stringify(filters)}`;
  const placed = placeSponsored(
    organic,
    (l) => ({ propertyId: l.property.id, advertiserId: l.property.workspaceId }),
    db().highlightCampaigns,
    HIGHLIGHT_SERVING,
    seed,
  );
  return placed.map((listing) => ({
    ...listing,
    installmentCents:
      listing.property.transaction === 'sale'
        ? simulateSac({
            priceCents: listing.property.priceCents,
            downPaymentCents: Math.round(listing.property.priceCents * 0.2),
          }).firstInstallmentCents
        : null,
    estimate: filters.invest ? investmentEstimate(listing.property) : null,
  }));
}
