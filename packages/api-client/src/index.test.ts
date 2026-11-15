import { describe, expect, it } from 'vitest';

import { createApiClient, isApiError } from './index.ts';

describe('api client', () => {
  it('calls typed endpoints with credentials', async () => {
    let seen: Request | undefined;
    const client = createApiClient('http://api.test', {
      fetch: async (input) => {
        seen = input as Request;
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const { data } = await client.GET('/v1/health');
    expect(data?.status).toBe('ok');
    expect(seen?.url).toBe('http://api.test/v1/health');
    expect(seen?.credentials).toBe('include');
  });

  it('recognises the API error shape', () => {
    expect(isApiError({ error: { code: 'not_found', message: 'Não encontramos…' } })).toBe(true);
    expect(isApiError({ status: 'ok' })).toBe(false);
  });
});
