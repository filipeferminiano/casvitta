import type { AiDraft, AiRules, Message } from '@/domain/types';
import { now } from '@/mocks/clock';

import { withScreenState } from './screen-state';
import { db, mutate, newId } from './store';
import { byId, conversationView, leadView, type ConversationView, type LeadView } from './views';

export type InboxTab = 'needs_you' | 'ai' | 'all';

export type Inbox = {
  conversations: ConversationView[];
  counts: { needsYou: number; ai: number; all: number };
};

const needsYou = (c: ConversationView) => c.aiMode === 'handed_off';

export function listConversations(): Promise<Inbox> {
  return withScreenState<Inbox>(
    { conversations: [], counts: { needsYou: 0, ai: 0, all: 0 } },
    () => {
      const data = db();
      const items = data.conversations
        .map((c) => conversationView(c, data))
        .sort(
          (a, b) =>
            Number(needsYou(b)) - Number(needsYou(a)) ||
            (b.lastMessage?.sentAt ?? '').localeCompare(a.lastMessage?.sentAt ?? ''),
        );
      // Mockup order: needs-you first, then AI-active conversations, then the rest by recency.
      const ordered = [
        ...items.filter(needsYou),
        ...items.filter((c) => c.aiMode === 'active' && c.lastMessage?.sender !== 'lead'),
        ...items.filter(
          (c) => !needsYou(c) && !(c.aiMode === 'active' && c.lastMessage?.sender !== 'lead'),
        ),
      ];
      return {
        conversations: ordered,
        counts: {
          needsYou: items.filter(needsYou).length,
          ai: items.filter((c) => c.aiMode === 'active' && c.lastMessage?.sender !== 'lead').length,
          all: items.length,
        },
      };
    },
  );
}

export type ConversationDetail = {
  conversation: ConversationView;
  lead: LeadView;
  messages: Message[];
  draft: AiDraft | null;
  rules: AiRules;
};

export function getConversation(conversationId: string): Promise<ConversationDetail | null> {
  return withScreenState<ConversationDetail | null>(null, () => {
    const data = db();
    const conversation = data.conversations.find((c) => c.id === conversationId);
    if (!conversation) return null;
    return {
      conversation: conversationView(conversation, data),
      lead: leadView(byId(data.leads, conversation.leadId), data),
      messages: data.messages
        .filter((msg) => msg.conversationId === conversationId)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
      draft: data.drafts.find((d) => d.conversationId === conversationId) ?? null,
      rules: data.aiRules,
    };
  });
}

export function getAiRules(): Promise<AiRules> {
  return Promise.resolve(db().aiRules);
}

/** Broker takes over: the AI stops answering this conversation. */
export async function takeOver(conversationId: string): Promise<void> {
  mutate((data) => {
    const conversation = byId(data.conversations, conversationId);
    conversation.aiMode = 'handed_off';
    conversation.handoffReason ??= 'você assumiu';
    data.messages.push({
      id: newId('msg'),
      conversationId,
      sender: 'system',
      body: 'takeover',
      sentAt: now().toISOString(),
    });
  });
}

/** Hand the conversation back to the AI assistant. */
export async function handBack(conversationId: string): Promise<void> {
  mutate((data) => {
    const conversation = byId(data.conversations, conversationId);
    conversation.aiMode = 'active';
    conversation.handoffReason = null;
    conversation.unread = 0;
    data.drafts = data.drafts.filter((d) => d.conversationId !== conversationId);
    data.messages.push({
      id: newId('msg'),
      conversationId,
      sender: 'system',
      body: 'handback',
      sentAt: now().toISOString(),
    });
  });
}

/** Sends a message as the broker (e.g. an approved AI draft). Sending keeps the human in control. */
export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  mutate((data) => {
    const conversation = byId(data.conversations, conversationId);
    conversation.aiMode = 'handed_off';
    conversation.unread = 0;
    data.drafts = data.drafts.filter((d) => d.conversationId !== conversationId);
    data.messages.push({
      id: newId('msg'),
      conversationId,
      sender: 'human',
      body: text,
      sentAt: now().toISOString(),
    });
  });
}

export async function discardDraft(conversationId: string): Promise<void> {
  mutate((data) => {
    data.drafts = data.drafts.filter((d) => d.conversationId !== conversationId);
  });
}

export async function markRead(conversationId: string): Promise<void> {
  mutate((data) => {
    byId(data.conversations, conversationId).unread = 0;
  });
}
