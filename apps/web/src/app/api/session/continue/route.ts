/**
 * App host: exchanges a one-time handoff code for a session on this host, then opens the app.
 * casvitta.com.br creates the code after sign-in (or at the end of /cadastro) and sends the
 * browser here; the code works once and only for 60 seconds.
 */
import type { NextRequest } from 'next/server';

import { API_INTERNAL_URL } from '@/lib/api';
import { absoluteRedirect, marketplaceOf, publicOrigin } from '@/lib/public-origin';

/** Only paths on this host: never an open redirect. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/inicio';
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const origin = publicOrigin(request);
  const failed = `${marketplaceOf(origin)}/entrar?sessao=expirada`;

  if (!code) return absoluteRedirect(failed);
  const claim = await fetch(`${API_INTERNAL_URL}/v1/auth/handoff/claim`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': request.headers.get('user-agent') ?? '',
    },
    body: JSON.stringify({ token: code }),
    cache: 'no-store',
  }).catch(() => null);
  if (!claim?.ok) return absoluteRedirect(failed);

  const response = absoluteRedirect(`${origin}${next}`);
  for (const cookie of claim.headers.getSetCookie()) response.headers.append('set-cookie', cookie);
  return response;
}
