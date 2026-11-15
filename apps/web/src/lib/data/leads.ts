import { STAGES, type ActiveStage, type TimelineEvent } from '@/domain/types';
import { now } from '@/mocks/clock';

import { withScreenState } from './screen-state';
import { db, mutate, newId } from './store';
import { byId, leadView, type LeadView } from './views';

export type KanbanColumn = { stage: ActiveStage; leads: LeadView[] };

export function activeLeads(): LeadView[] {
  const data = db();
  return data.leads
    .filter((lead) => (STAGES as readonly string[]).includes(lead.stage))
    .map((lead) => leadView(lead, data))
    .sort(
      (a, b) =>
        Number(b.needsHuman) - Number(a.needsHuman) ||
        b.lastActivityAt.localeCompare(a.lastActivityAt),
    );
}

export function listKanban(): Promise<KanbanColumn[]> {
  const empty = STAGES.map((stage) => ({ stage, leads: [] }));
  return withScreenState<KanbanColumn[]>(empty, () => {
    const leads = activeLeads();
    return STAGES.map((stage) => ({ stage, leads: leads.filter((l) => l.stage === stage) }));
  });
}

export type LeadDetail = {
  lead: LeadView;
  timeline: TimelineEvent[];
  alsoMatches: {
    propertyId: string;
    label: string;
    priceCents: number;
    origin: 'catalog' | 'network';
  }[];
  /** AI suggestion for the broker's next step (null when there is none). */
  nextStep: string | null;
};

export function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  return withScreenState<LeadDetail | null>(null, () => {
    const data = db();
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead) return null;
    return {
      lead: leadView(lead, data),
      timeline: data.timeline
        .filter((e) => e.leadId === leadId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      alsoMatches:
        lead.propertyId === 'prop-vm'
          ? [
              {
                propertyId: 'net-saude',
                label: 'Apto Saúde · 2 qts',
                priceCents: 65_500_000,
                origin: 'network',
              },
              {
                propertyId: 'cat-vm-2',
                label: 'Apto Vila Mariana · 2 qts',
                priceCents: 71_000_000,
                origin: 'catalog',
              },
            ]
          : [],
      nextStep:
        lead.stage === 'proposal' &&
        data.proposals.filter((p) => p.propertyId === lead.propertyId).length > 1
          ? 'O proprietário tem duas propostas. A do Marcos é maior, mas depende do banco. Sugestão: pedir ao Marcos uma pré-análise de crédito no banco dele para fortalecer a proposta.'
          : null,
    };
  });
}

/** Move a lead on the Kanban and record it on the timeline. */
export async function moveLead(leadId: string, stage: ActiveStage): Promise<void> {
  mutate((data) => {
    const lead = byId(data.leads, leadId);
    if (lead.stage === stage) return;
    lead.stage = stage;
    lead.lastActivityAt = now().toISOString();
    data.timeline.push({
      id: newId('ev'),
      leadId,
      type: 'stage_changed',
      // Rendered from the catalog: title holds the stage key for type 'stage_changed'.
      title: stage,
      detail: '',
      occurredAt: now().toISOString(),
    });
  });
}

export async function markLeadSeen(leadId: string): Promise<void> {
  mutate((data) => {
    byId(data.leads, leadId).unseen = false;
  });
}
