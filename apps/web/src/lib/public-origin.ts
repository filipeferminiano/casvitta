import type { NextRequest } from 'next/server';

/**
 * The origin the visitor used. Behind the load balancer Next sees plain HTTP on an internal
 * host, so read the forwarded headers; in development the Host header (app.localhost:3000).
 */
export function publicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0] ?? request.nextUrl.protocol;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return `${proto.replace(/:$/, '')}://${host ?? request.nextUrl.host}`;
}

/** app.casvitta.com.br -> casvitta.com.br (app.localhost:3000 -> localhost:3000). */
export const marketplaceOf = (origin: string) => origin.replace('://app.', '://');

/**
 * A redirect whose Location stays absolute. NextResponse.redirect may shorten it to a relative
 * path when the target matches the server's own origin (localhost in development), which would
 * keep a cross-host redirect on the app host.
 */
export const absoluteRedirect = (location: string) =>
  new Response(null, { status: 307, headers: { location, 'cache-control': 'no-store' } });
