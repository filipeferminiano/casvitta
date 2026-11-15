import { STAGES, type ActiveStage, type Campaign } from '@/domain/types';
import { now } from '@/mocks/clock';
import { COMMISSION_PCT } from '@/mocks/fixtures';

import { getDay, todayISO, type AppointmentView } from './calendar';
import { activeLeads } from './leads';
import { withScreenState } from './screen-state';
import { db } from './store';

export type NeedsYouItem =
  | {
      kind: 'compare_proposals';
      propertyShortName: string;
      proposals: { name: string; amountCents: number; payment: string }[];
    }
  | { kind: 'handoff'; leadName: string; reason: string; since: string; conversationId: string }
  | { kind: 'stale_leads'; count: number };

export type Dashboard = {
  firstName: string;
  today: string;
  stats: {
    activeLeads: number;
    newThisWeek: number;
    visitsThisWeek: number;
    confirmedThisWeek: number;
    openProposals: number;
    openProposalsProperty: string | null;
    commissionCents: number;
  };
  needsYou: NeedsYouItem[];
  todayAgenda: AppointmentView[];
  funnel: { stage: ActiveStage; count: number }[];
  campaign: (Campaign & { costPerVisitCents: number | null }) | null;
};

const DAY_MS = 86_400_000;

export async function getDashboard(): Promise<Dashboard | null> {
  const todayAgenda = await getDay(todayISO());
  return withScreenState<Dashboard | null>(null, () => {
    const data = db();
    const leads = activeLeads();
    const nowMs = now().getTime();
    const weekStart = todayISO();
    const weekEnd = new Date(new Date(`${weekStart}T00:00:00-03:00`).getTime() + 7 * DAY_MS);
    const weekVisits = data.appointments.filter((a) => {
      const at = new Date(a.startsAt);
      return (
        a.kind === 'visit' &&
        a.status !== 'cancelled' &&
        at >= new Date(`${weekStart}T00:00:00-03:00`) &&
        at < weekEnd
      );
    });
    const open = data.proposals.filter(
      (p) => p.status === 'sent_to_owner' || p.status === 'countered',
    );
    const best = open.reduce((max, p) => Math.max(max, p.amountCents), 0);
    const proposalProperty = open[0]
      ? data.properties.find((p) => p.id === open[0]!.propertyId)
      : null;

    const needsYou: NeedsYouItem[] = [];
    if (open.length > 1 && proposalProperty) {
      needsYou.push({
        kind: 'compare_proposals',
        propertyShortName: proposalProperty.shortName,
        proposals: open.map((p) => ({
          name:
            data.people.find((x) => x.id === data.leads.find((l) => l.id === p.leadId)?.personId)
              ?.name ?? '',
          amountCents: p.amountCents,
          payment: p.payment,
        })),
      });
    }
    for (const conversation of data.conversations.filter(
      (c) => c.aiMode === 'handed_off' && c.handoffReason,
    )) {
      const lead = leads.find((l) => l.id === conversation.leadId);
      const handoff = data.messages.find(
        (m) =>
          m.conversationId === conversation.id &&
          m.sender === 'system' &&
          m.body.startsWith('handoff'),
      );
      if (lead) {
        needsYou.push({
          kind: 'handoff',
          leadName: lead.person.name,
          reason: lead.note ?? conversation.handoffReason ?? '',
          since: handoff?.sentAt ?? lead.lastActivityAt,
          conversationId: conversation.id,
        });
      }
    }
    const stale = leads.filter(
      (l) => nowMs - new Date(l.lastActivityAt).getTime() > 2 * DAY_MS && l.stage !== 'proposal',
    );
    if (stale.length > 0) needsYou.push({ kind: 'stale_leads', count: stale.length });

    const campaign = data.campaigns.find((c) => c.status === 'live') ?? null;
    return {
      firstName: data.broker.firstName,
      today: now().toISOString(),
      stats: {
        activeLeads: leads.length,
        newThisWeek: leads.filter((l) => nowMs - new Date(l.createdAt).getTime() < 7 * DAY_MS)
          .length,
        visitsThisWeek: weekVisits.length,
        confirmedThisWeek: weekVisits.filter((a) => a.status === 'confirmed').length,
        openProposals: open.length,
        openProposalsProperty: proposalProperty?.shortName ?? null,
        commissionCents: Math.round((best * COMMISSION_PCT) / 100),
      },
      needsYou,
      todayAgenda,
      funnel: STAGES.map((stage) => ({
        stage,
        count: leads.filter((l) => l.stage === stage).length,
      })),
      campaign: campaign
        ? {
            ...campaign,
            costPerVisitCents: campaign.week.visits
              ? Math.round(campaign.week.spentCents / campaign.week.visits)
              : null,
          }
        : null,
    };
  });
}
