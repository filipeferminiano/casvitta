/** Read models joined for screens. Built only inside lib/data. */
import type {
  Appointment,
  Conversation,
  Lead,
  Message,
  Person,
  Property,
  Proposal,
} from '@/domain/types';

import { db, type Db } from './store';

export type LeadView = Lead & {
  person: Person;
  property: Property;
  nextAppointment: Appointment | null;
  proposal: Proposal | null;
  conversationId: string | null;
  aiMode: Conversation['aiMode'] | null;
};

export type ConversationView = Conversation & {
  lead: Lead;
  person: Person;
  property: Property;
  lastMessage: Message | null;
};

export function byId<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`Not found: ${id}`);
  return found;
}

export function leadView(lead: Lead, data: Db = db()): LeadView {
  const upcoming = data.appointments
    .filter((a) => a.leadId === lead.id && a.status !== 'cancelled' && a.status !== 'done')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const conversation = data.conversations.find((c) => c.leadId === lead.id);
  return {
    ...lead,
    person: byId(data.people, lead.personId),
    property: byId(data.properties, lead.propertyId),
    nextAppointment: upcoming[0] ?? null,
    proposal: data.proposals.find((p) => p.leadId === lead.id) ?? null,
    conversationId: conversation?.id ?? null,
    aiMode: conversation?.aiMode ?? null,
  };
}

export function conversationView(conversation: Conversation, data: Db = db()): ConversationView {
  const lead = byId(data.leads, conversation.leadId);
  const thread = data.messages
    .filter((msg) => msg.conversationId === conversation.id && msg.sender !== 'system')
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  return {
    ...conversation,
    lead,
    person: byId(data.people, lead.personId),
    property: byId(data.properties, lead.propertyId),
    lastMessage: thread.at(-1) ?? null,
  };
}
