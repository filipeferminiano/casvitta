import type { Property, Proposal } from '@/domain/types';
import { COMMISSION_PCT } from '@/mocks/fixtures';

import { now } from '@/mocks/clock';

import { withScreenState } from './screen-state';
import { db, mutate } from './store';
import { byId, leadView, type LeadView } from './views';

export type ProposalView = Proposal & {
  lead: LeadView;
  differenceCents: number; // amount − asking price (negative = below)
  commissionCents: number;
};

export type PropertyProposals = {
  property: Property;
  proposals: ProposalView[];
  /** Plain-language comparison for the owner, drafted by the AI. */
  ownerSummary: string | null;
  comparisonSentAt: string | null;
};

export const commissionPct = COMMISSION_PCT;

export function listPropertiesWithProposals(): Promise<PropertyProposals[]> {
  return withScreenState<PropertyProposals[]>([], () => {
    const data = db();
    return data.properties
      .filter((p) => p.status !== 'unauthorized')
      .map((property) => {
        const items = data.proposals
          .filter((p) => p.propertyId === property.id && p.status !== 'rejected')
          .sort((a, b) => b.amountCents - a.amountCents)
          .map((proposal) => ({
            ...proposal,
            lead: leadView(byId(data.leads, proposal.leadId), data),
            differenceCents: proposal.amountCents - property.priceCents,
            commissionCents: Math.round((proposal.amountCents * COMMISSION_PCT) / 100),
          }));
        return {
          property,
          proposals: items,
          ownerSummary:
            property.id === 'prop-vm' && items.length === 2
              ? 'A proposta do Marcos paga R$ 7 mil a mais, mas depende do banco e leva até 60 dias. A do Pedro é à vista, em até 30 dias. Uma pré-análise de crédito do Marcos reduziria a incerteza antes da decisão.'
              : null,
          comparisonSentAt: data.comparisonsSent[property.id] ?? null,
        };
      });
  });
}

/** Sends the side-by-side comparison to the owner (WhatsApp/email in Milestone 1). */
export async function sendComparison(propertyId: string): Promise<void> {
  mutate((data) => {
    data.comparisonsSent[propertyId] = now().toISOString();
  });
}

/** Records the owner's counter-offer on a proposal. */
export async function registerCounter(proposalId: string, amountCents: number): Promise<void> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Invalid amount');
  mutate((data) => {
    const proposal = byId(data.proposals, proposalId);
    proposal.status = 'countered';
    proposal.counterAmountCents = amountCents;
  });
}
