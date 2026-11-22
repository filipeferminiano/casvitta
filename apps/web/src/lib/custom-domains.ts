/**
 * Custom domains (Casvitta Social): which broker page a hostname serves. Called by the proxy for
 * hosts that are not ours; answers (and misses) are cached for a minute per server instance.
 */
import { API_INTERNAL_URL } from '@/lib/api';

const TTL_MS = 60_000;
const cache = new Map<string, { slug: string | null; until: number }>();

export async function customDomainSlug(host: string): Promise<string | null> {
  const hostname = host.toLowerCase().split(':')[0] ?? '';
  const hit = cache.get(hostname);
  if (hit && hit.until > Date.now()) return hit.slug;
  let slug: string | null = null;
  try {
    const response = await fetch(
      `${API_INTERNAL_URL}/v1/public/domains/${encodeURIComponent(hostname)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(2000) },
    );
    if (response.ok) slug = ((await response.json()) as { slug: string }).slug;
  } catch {
    return null; // API unreachable: treat as unknown host, do not cache
  }
  cache.set(hostname, { slug, until: Date.now() + TTL_MS });
  return slug;
}
