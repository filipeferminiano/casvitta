import { connection } from 'next/server';

const KEY = /^[A-Za-z0-9-]{8,128}$/;

/**
 * IndexNow key file (https://www.indexnow.org/documentation), served on every host so one key
 * covers the marketplace and each broker subdomain. The API submits keyLocation
 * https://{host}/indexnow-key.txt. INDEXNOW_KEY is read at request time (not inlined at build).
 */
export async function GET(): Promise<Response> {
  await connection(); // never prerender: the key comes from the runtime environment
  const key = process.env.INDEXNOW_KEY ?? '';
  if (!KEY.test(key)) return new Response('Not found', { status: 404 });
  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
