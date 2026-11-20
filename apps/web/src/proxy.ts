import { NextResponse, type NextRequest } from 'next/server';

import { resolveSite, routeRequest } from '@/lib/hosts';
import { isLive } from '@/lib/live';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'localhost:3000';
const APP_SUBDOMAIN = process.env.APP_SUBDOMAIN ?? 'app';

/** Routes each host to its route group (see src/lib/hosts.ts). */
export function proxy(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const site = resolveSite(host, ROOT_DOMAIN, APP_SUBDOMAIN);
  const decision = routeRequest(site, request.nextUrl.pathname, ROOT_DOMAIN, APP_SUBDOMAIN);

  // Broker OS needs a session: signed-out visitors go to sign in on the marketplace host.
  // (cv_session only marks that a session exists; the API checks the real tokens.)
  if (site.kind === 'app' && isLive('accounts') && !request.cookies.has('cv_session')) {
    // Same-host hop: the route answers with an absolute redirect to the marketplace host.
    return NextResponse.redirect(new URL('/api/session/sign-in', request.url));
  }

  switch (decision.action) {
    case 'next':
      return NextResponse.next();
    case 'rewrite': {
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      return NextResponse.rewrite(url);
    }
    case 'redirect': {
      const url = request.nextUrl.clone();
      url.host = decision.host;
      url.pathname = decision.pathname;
      return NextResponse.redirect(url, 308);
    }
    case 'not-found': {
      const url = request.nextUrl.clone();
      url.pathname = '/_not-found';
      return NextResponse.rewrite(url, { status: 404 });
    }
  }
}

export const config = {
  // Skip Next internals and files with an extension (static assets, icons).
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
};
