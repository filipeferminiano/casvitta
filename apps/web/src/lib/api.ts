import { createApiClient } from '@casvitta/api-client';

/**
 * Browsers call the API on their own host at /api/v1 (the load balancer routes it in production,
 * next.config rewrites it in development), so session cookies stay first-party on each host.
 * Server code (route handlers) calls API_INTERNAL_URL directly.
 */
export const API_PATH = '/api';
export const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that got a 401 meanwhile. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch(`${API_PATH}/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** The access token lives 15 minutes: on a 401, refresh the session once and retry. */
async function fetchWithRefresh(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  const retry = request.clone();
  const response = await fetch(request);
  if (response.status !== 401 || new URL(request.url).pathname.includes('/v1/auth/')) {
    return response;
  }
  if (await refreshOnce()) return fetch(retry);
  if (typeof window !== 'undefined' && window.location.host.startsWith('app.')) {
    // The session ended (signed out elsewhere, expired): sign in again on the marketplace host.
    const { protocol, host } = window.location;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- other host
    window.location.assign(`${protocol}//${host.slice(4)}/entrar?sessao=expirada`);
  }
  return response;
}

/** Typed API client (generated from the FastAPI OpenAPI schema with `pnpm api:gen`). */
export const api = createApiClient(typeof window === 'undefined' ? API_INTERNAL_URL : API_PATH, {
  fetch: fetchWithRefresh,
});
