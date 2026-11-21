/**
 * In-memory mock database (NEXT_PUBLIC_USE_MOCKS=true).
 *
 * On the client it persists to sessionStorage so actions survive navigation and reloads within a
 * tab. On the server every request reads the pristine fixtures (never mutated). Data modules in
 * this folder are the only code that touches it; screens use the hooks in ./hooks.ts.
 */
import type { AdDraft, SignupDraft } from '@/domain/types';
import * as fx from '@/mocks/fixtures';

export type Db = {
  broker: typeof fx.broker;
  properties: typeof fx.properties;
  people: typeof fx.people;
  leads: typeof fx.leads;
  timeline: typeof fx.timeline;
  conversations: typeof fx.conversations;
  messages: typeof fx.messages;
  drafts: typeof fx.drafts;
  aiRules: typeof fx.aiRules;
  aiCanBook: boolean;
  slots: typeof fx.slots;
  appointments: typeof fx.appointments;
  proposals: typeof fx.proposals;
  creatives: typeof fx.creatives;
  campaigns: typeof fx.campaigns;
  highlightCampaigns: typeof fx.highlightCampaigns;
  reports: typeof fx.reports;
  socialPosts: typeof fx.socialPosts;
  modules: typeof fx.modules;
  moduleInterest: { key: string; at: string }[];
  adDraft: AdDraft;
  /** Buyer-side visit picked on the marketplace chat, by property slug. */
  buyerVisits: Record<string, string>;
  /** When the proposal comparison was sent to the owner, by property id. */
  comparisonsSent: Record<string, string>;
  /** Capture-page signups in mock mode (the API stores them otherwise). */
  interestSignups: (Record<string, unknown> & { createdAt: string; status: string })[];
  /** Broker signup drafts from /cadastro, by opaque id. */
  signups: Record<string, SignupDraft>;
};

const STORAGE_KEY = 'casvitta.mockdb.v5';

export const DEFAULT_AD_DRAFT: AdDraft = {
  propertyId: null,
  creativeVariant: 1,
  editedTitle: null,
  editedBody: null,
  coverPhoto: 1,
  channels: ['landing', 'marketplace', 'meta', 'google'],
  dailyBudgetCents: 3_000,
  durationDays: 14,
};

function seed(): Db {
  return structuredClone({
    broker: fx.broker,
    properties: fx.properties,
    people: fx.people,
    leads: fx.leads,
    timeline: fx.timeline,
    conversations: fx.conversations,
    messages: fx.messages,
    drafts: fx.drafts,
    aiRules: fx.aiRules,
    aiCanBook: true,
    slots: fx.slots,
    appointments: fx.appointments,
    proposals: fx.proposals,
    creatives: fx.creatives,
    campaigns: fx.campaigns,
    highlightCampaigns: fx.highlightCampaigns,
    reports: fx.reports,
    socialPosts: fx.socialPosts,
    modules: fx.modules,
    moduleInterest: [],
    adDraft: DEFAULT_AD_DRAFT,
    buyerVisits: {},
    comparisonsSent: {},
    interestSignups: [],
    signups: {},
  });
}

const isBrowser = typeof window !== 'undefined';
let clientDb: Db | null = null;
const serverDb: Db = seed();

export function db(): Db {
  if (!isBrowser) return serverDb;
  if (!clientDb) {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    clientDb = saved ? (JSON.parse(saved) as Db) : seed();
  }
  return clientDb;
}

/** Apply a change and persist it. Server-side writes are refused: fixtures stay pristine. */
export function mutate<T>(change: (data: Db) => T): T {
  if (!isBrowser) throw new Error('Mock writes only happen in the browser');
  const data = db();
  const result = change(data);
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return result;
}

export function resetDb(): void {
  clientDb = seed();
  if (isBrowser) window.sessionStorage.removeItem(STORAGE_KEY);
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
