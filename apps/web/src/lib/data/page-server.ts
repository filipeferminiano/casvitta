import { headers } from 'next/headers';

export { getPublicPage, movedTo } from './page';

/** The host the visitor asked for (the load balancer sets x-forwarded-host). */
export async function requestHost(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-host') ?? h.get('host') ?? '';
}
