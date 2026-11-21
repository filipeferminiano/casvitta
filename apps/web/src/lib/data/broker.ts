import type { BrokerProfile } from '@/domain/types';
import { api } from '@/lib/api';
import { isLive } from '@/lib/live';

import { db, mutate } from './store';

/**
 * The signed-in broker. Live: from /me, also copied into the demo store so screens that still
 * run on demo data (e.g. Anúncios) apply the real CRECI status (CLAUDE.md rule 1).
 */
export async function getBroker(): Promise<BrokerProfile> {
  if (!isLive('accounts')) return db().broker;
  const { data } = await api.GET('/v1/me');
  if (!data) throw new Error('me_failed');
  const b = data.broker;
  const creci = b?.creci_number ? `CRECI-${b.creci_state ?? ''} ${b.creci_number}` : '';
  const broker: BrokerProfile = {
    id: b?.id ?? data.user.id,
    workspaceId: data.workspace.id,
    displayName: b?.display_name ?? data.user.name,
    firstName: (b?.display_name ?? data.user.name).split(' ')[0] ?? '',
    roleLabel: creci,
    creciNumber: b?.creci_number ?? '',
    creciState: b?.creci_state ?? '',
    creciVerifiedAt: b?.creci_verified_at ?? null,
    creciReviewReason: b?.creci_review_reason ?? null,
    creciRejected: b?.creci_review_status === 'rejected',
    slug: b?.slug ?? '',
    regions: b?.regions ?? [],
    phoneE164: b?.whatsapp_e164 ?? '',
    plan: data.workspace.plan,
    isDemo: b?.is_demo ?? false,
  };
  mutate((store) => {
    store.broker = broker;
  });
  return broker;
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
