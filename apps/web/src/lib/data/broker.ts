import type { BrokerProfile } from '@/domain/types';

import { db } from './store';

export function getBroker(): Promise<BrokerProfile> {
  return Promise.resolve(db().broker);
}

export type NavCounts = { leads: number; conversations: number };

/** Side navigation counters: unseen leads and conversations with unread messages. */
export function getNavCounts(): Promise<NavCounts> {
  const data = db();
  return Promise.resolve({
    leads: data.leads.filter((l) => l.unseen).length,
    conversations: data.conversations.filter((c) => c.unread > 0).length,
  });
}
