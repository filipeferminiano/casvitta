/**
 * Interest signups from capture pages (CLAUDE.md rule 11). Calls the API when
 * NEXT_PUBLIC_USE_MOCKS=false, otherwise stores in the in-memory demo store.
 */
import { isApiError, type paths } from '@casvitta/api-client';

import { api } from '@/lib/api';
import { USE_MOCKS, now } from '@/mocks/clock';

import { mutate } from './store';

export type InterestPayload =
  paths['/v1/public/interest']['post']['requestBody']['content']['application/json'];

export type InterestResult =
  | { ok: true; optIn: 'whatsapp_sent' | 'not_requested' }
  | { ok: false; message: string; fields: Record<string, string> };

export async function submitInterest(payload: InterestPayload): Promise<InterestResult> {
  if (USE_MOCKS) {
    if (payload.website) return { ok: true, optIn: 'not_requested' };
    mutate((data) => {
      data.interestSignups.push({
        ...payload,
        createdAt: now().toISOString(),
        status: 'pending_opt_in',
      });
    });
    return { ok: true, optIn: 'whatsapp_sent' };
  }
  const { data, error } = await api.POST('/v1/public/interest', { body: payload });
  if (data) return { ok: true, optIn: data.opt_in };
  if (isApiError(error)) {
    const fields: Record<string, string> = {};
    for (const f of error.error.fields ?? []) fields[f.path.join('.')] = f.message;
    return { ok: false, message: error.error.message, fields };
  }
  return { ok: false, message: '', fields: {} };
}
