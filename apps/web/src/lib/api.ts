import { createApiClient } from '@casvitta/api-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Typed API client (generated from the FastAPI OpenAPI schema with `pnpm api:gen`). */
export const api = createApiClient(API_URL);
