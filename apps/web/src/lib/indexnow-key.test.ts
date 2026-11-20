import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/indexnow-key.txt/route';

vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

afterEach(() => vi.unstubAllEnvs());

describe('/indexnow-key.txt', () => {
  it('serves the key as plain text', async () => {
    vi.stubEnv('INDEXNOW_KEY', '0123456789abcdef0123456789abcdef');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('0123456789abcdef0123456789abcdef');
  });

  it.each(['', 'short', 'not a key!'])(
    'is 404 for a missing or malformed key (%j)',
    async (key) => {
      vi.stubEnv('INDEXNOW_KEY', key);
      expect((await GET()).status).toBe(404);
    },
  );
});
