import createClient, { type Client } from 'openapi-fetch';

import type { components, paths } from './schema.ts';

export type { components, paths };
export type ApiClient = Client<paths>;

/** Shape of every API error body (see apps/api/app/core/errors.py). */
export type ApiError = {
  error: {
    code: string;
    message: string;
    fields?: { path: string[]; code: string; message: string }[];
  };
};

/** Typed client. Sends the session cookie (httpOnly) on every request. */
export function createApiClient(baseUrl: string, init?: { fetch?: typeof fetch }): ApiClient {
  return createClient<paths>({ baseUrl, credentials: 'include', ...init });
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiError).error?.code === 'string'
  );
}
