import { revalidateTag } from 'next/cache';

import { MARKET_TAG } from '@/lib/data/market';

/**
 * Called by the API after each ITBI refresh (WEB_REVALIDATE_URL + WEB_REVALIDATE_SECRET there,
 * REVALIDATE_SECRET here): price pages serve stale content while they re-render in the background.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!secret || given !== secret) return new Response('Unauthorized', { status: 401 });
  revalidateTag(MARKET_TAG, 'max');
  return Response.json({ revalidated: [MARKET_TAG] });
}
