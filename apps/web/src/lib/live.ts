/**
 * Which areas already read and write the real API while the rest of the app still uses the demo
 * store. NEXT_PUBLIC_LIVE lists them, separated by "+", "," or spaces (e.g. "interest+accounts"; "+"
 * survives gcloud --substitutions); with
 * NEXT_PUBLIC_USE_MOCKS=false every area is live.
 */
import { USE_MOCKS } from '@/mocks/clock';

export type LiveArea = 'interest' | 'accounts' | 'market' | 'listings' | 'crm' | 'social';

const LIVE = new Set(
  (process.env.NEXT_PUBLIC_LIVE ?? '')
    .split(/[\s,+]+/)
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isLive(area: LiveArea): boolean {
  return !USE_MOCKS || LIVE.has(area);
}
