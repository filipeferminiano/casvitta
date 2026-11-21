import { createApiClient, isApiError } from '@casvitta/api-client';

import { API_PATH } from '@/lib/api';

/**
 * Backoffice API client (admin host). Staff cookies are scoped to /api/v1/staff on this host, so
 * a customer session never reaches these endpoints. The access token lives 10 minutes: on a 401,
 * refresh once and retry; if the session is over, back to the sign-in page.
 */
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch(`${API_PATH}/v1/staff/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export const SESSION_EXPIRED_PATH = '/entrar?sessao=expirada';

async function fetchWithStaffRefresh(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  const retry = request.clone();
  const response = await fetch(request);
  if (response.status !== 401 || new URL(request.url).pathname.includes('/v1/staff/auth/')) {
    return response;
  }
  if (await refreshOnce()) return fetch(retry);
  if (typeof window !== 'undefined') {
    // Full reload on purpose: drops every cached query of the ended session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(SESSION_EXPIRED_PATH);
  }
  return response;
}

export const staffApi = createApiClient(API_PATH, { fetch: fetchWithStaffRefresh });

/** Error raised by the data layer: the API code ("reauth_required", "forbidden", …). */
export class StaffApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Unwraps an openapi-fetch result or throws StaffApiError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    if (isApiError(result.error)) {
      throw new StaffApiError(
        result.error.error.code,
        result.error.error.message,
        result.response.status,
      );
    }
    throw new StaffApiError('unknown', '', result.response.status);
  }
  return result.data;
}

export function isReauthRequired(error: unknown): boolean {
  return error instanceof StaffApiError && error.code === 'reauth_required';
}

/** Downloads a CSV from a staff endpoint (cookies included), keeping the server's filename. */
export async function downloadCsv(path: string, params: Record<string, string>): Promise<void> {
  const query = new URLSearchParams(params).toString();
  const response = await fetchWithStaffRefresh(
    new Request(`${API_PATH}${path}${query ? `?${query}` : ''}`, { credentials: 'include' }),
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (isApiError(body)) {
      throw new StaffApiError(body.error.code, body.error.message, response.status);
    }
    throw new StaffApiError('unknown', '', response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
