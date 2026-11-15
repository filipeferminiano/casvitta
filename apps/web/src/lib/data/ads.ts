/**
 * Anúncios (Ads Studio internally): the 3-step flow, live ad panel and weekly report.
 * Rules enforced here as in the API later: no authorization -> no publishing (CLAUDE.md §4.2);
 * daily budget ≥ minimum; max spend = daily × days (§4.10).
 */
import type {
  AdChannel,
  AdCreative,
  AdDraft,
  Campaign,
  Property,
  WeeklyReport,
} from '@/domain/types';
import { now } from '@/mocks/clock';

import { withScreenState } from './screen-state';
import { DEFAULT_AD_DRAFT, db, mutate, newId } from './store';
import { byId, leadView, type LeadView } from './views';

export const MIN_DAILY_BUDGET_CENTS = Number(
  process.env.NEXT_PUBLIC_MIN_DAILY_BUDGET_CENTS ?? 2_000,
);
export const BUDGET_SUGGESTIONS_CENTS = [2_000, 3_000, 5_000] as const;
export const RECOMMENDED_BUDGET_CENTS = 3_000;
/** Observed range for similar properties at the recommended budget (never a promise). */
export const RECOMMENDED_RANGE = { min: 8, max: 14, days: 7 } as const;

export type PickerProperty = Property & { publishable: boolean };

export function isPublishable(property: Property): boolean {
  if (!property.authorization) return false;
  return new Date(property.authorization.expiresAt) > now();
}

export function listPickerProperties(): Promise<PickerProperty[]> {
  return withScreenState<PickerProperty[]>([], () =>
    db().properties.map((p) => ({ ...p, publishable: isPublishable(p) })),
  );
}

export function getAdDraft(): Promise<AdDraft> {
  return Promise.resolve(db().adDraft);
}

export async function selectProperty(propertyId: string): Promise<void> {
  mutate((data) => {
    const property = byId(data.properties, propertyId);
    if (!isPublishable(property)) throw new Error('Property has no valid owner authorization');
    data.adDraft = { ...DEFAULT_AD_DRAFT, propertyId };
  });
}

/** The creative for the current draft (null when the flow hasn't picked a property). */
export function getDraftCreative(): Promise<{
  creative: AdCreative;
  property: Property;
  variants: number;
} | null> {
  return withScreenState(null, () => {
    const data = db();
    const { propertyId, creativeVariant } = data.adDraft;
    if (!propertyId) return null;
    const options = data.creatives.filter((c) => c.propertyId === propertyId);
    const creative = options.find((c) => c.variant === creativeVariant) ?? options[0];
    if (!creative) return null;
    return { creative, property: byId(data.properties, propertyId), variants: options.length };
  });
}

/** "Gerar outra versão": the fake generator cycles through the fixture variants. */
export async function regenerateCreative(): Promise<void> {
  mutate((data) => {
    const count = data.creatives.filter((c) => c.propertyId === data.adDraft.propertyId).length;
    data.adDraft.creativeVariant = (data.adDraft.creativeVariant % Math.max(count, 1)) + 1;
  });
}

export async function updateDraft(
  patch: Partial<Pick<AdDraft, 'channels' | 'dailyBudgetCents' | 'durationDays'>>,
): Promise<void> {
  mutate((data) => {
    data.adDraft = { ...data.adDraft, ...patch };
  });
}

export function maxSpendCents(draft: Pick<AdDraft, 'dailyBudgetCents' | 'durationDays'>): number {
  return draft.dailyBudgetCents * draft.durationDays;
}

export const PAID_CHANNELS: AdChannel[] = ['meta', 'google'];

/** Publishes the draft: creates the campaign (landing page + listings) and returns its id. */
export async function publishDraft(): Promise<string> {
  return mutate((data) => {
    const draft = data.adDraft;
    if (!draft.propertyId) throw new Error('No property selected');
    const property = byId(data.properties, draft.propertyId);
    if (!isPublishable(property)) throw new Error('Property has no valid owner authorization');
    if (draft.dailyBudgetCents < MIN_DAILY_BUDGET_CENTS)
      throw new Error('Daily budget below minimum');
    const creative =
      data.creatives.find(
        (c) => c.propertyId === property.id && c.variant === draft.creativeVariant,
      ) ?? data.creatives.find((c) => c.propertyId === property.id);
    if (!creative) throw new Error('No creative');

    const campaign: Campaign = {
      id: newId('camp'),
      propertyId: property.id,
      creativeId: creative.id,
      channels: draft.channels,
      dailyBudgetCents: draft.dailyBudgetCents,
      durationDays: draft.durationDays,
      maxSpendCents: maxSpendCents(draft),
      regionLabel: `5 km da ${property.neighborhood}`,
      startsAt: now().toISOString(),
      status: 'live',
      stats: {
        spentCents: 0,
        day: 1,
        reach: 0,
        clicks: 0,
        conversations: 0,
        qualified: 0,
        visits: 0,
      },
      week: { number: 1, days: 0, spentCents: 0, leads: 0, visits: 0, note: '' },
    };
    // One live campaign per property: the new one replaces the previous.
    data.campaigns = data.campaigns.filter((c) => c.propertyId !== property.id).concat(campaign);
    for (const lead of data.leads)
      if (lead.propertyId === property.id && lead.campaignId) lead.campaignId = campaign.id;
    property.status = 'live';
    data.adDraft = DEFAULT_AD_DRAFT;
    return campaign.id;
  });
}

export type CampaignPanel = {
  campaign: Campaign;
  property: Property;
  leads: LeadView[];
  newestLead: LeadView | null;
  costPerLeadCents: number | null;
  costPerVisitCents: number | null;
  paidChannels: number;
};

export function getCampaignPanel(campaignId: string): Promise<CampaignPanel | null> {
  return withScreenState<CampaignPanel | null>(null, () => {
    const data = db();
    const campaign = data.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return null;
    const leads = data.leads
      .filter(
        (l) =>
          l.propertyId === campaign.propertyId &&
          ['instagram', 'facebook', 'google', 'marketplace'].includes(l.source),
      )
      .map((l) => leadView(l, data))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { stats } = campaign;
    return {
      campaign,
      property: byId(data.properties, campaign.propertyId),
      leads: leads.slice(0, 4),
      newestLead: leads[0] ?? null,
      costPerLeadCents: stats.conversations
        ? Math.round(stats.spentCents / stats.conversations)
        : null,
      costPerVisitCents: stats.visits ? Math.round(stats.spentCents / stats.visits) : null,
      paidChannels: campaign.channels.filter((c) => c !== 'landing').length,
    };
  });
}

export function listCampaigns(): Promise<Campaign[]> {
  return Promise.resolve(db().campaigns);
}

export type ReportView = WeeklyReport & {
  property: Property;
  totals: { spentCents: number; leads: number; qualified: number; visits: number };
};

export function getReport(reportId: string): Promise<ReportView | null> {
  return withScreenState<ReportView | null>(null, () => {
    const data = db();
    const report = data.reports.find((r) => r.id === reportId);
    if (!report) return null;
    const totals = report.rows.reduce(
      (acc, r) => ({
        spentCents: acc.spentCents + r.spentCents,
        leads: acc.leads + r.leads,
        qualified: acc.qualified + r.qualified,
        visits: acc.visits + r.visits,
      }),
      { spentCents: 0, leads: 0, qualified: 0, visits: 0 },
    );
    return { ...report, property: byId(data.properties, report.propertyId), totals };
  });
}

/** "Aplicar sugestão": the report suggestion moves budget; recorded on the campaign note. */
export async function applySuggestion(reportId: string): Promise<void> {
  mutate((data) => {
    const report = byId(data.reports, reportId);
    const campaign = data.campaigns.find((c) => c.id === report.campaignId);
    if (campaign) campaign.week.note = 'Sugestão aplicada: +R$ 10/dia em Instagram e Facebook.';
  });
}
