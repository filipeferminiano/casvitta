/** App host, signed out: go to sign in on the marketplace host (src/proxy.ts sends here). */
import type { NextRequest } from 'next/server';

import { absoluteRedirect, marketplaceOf, publicOrigin } from '@/lib/public-origin';

export function GET(request: NextRequest) {
  return absoluteRedirect(`${marketplaceOf(publicOrigin(request))}/entrar`);
}
