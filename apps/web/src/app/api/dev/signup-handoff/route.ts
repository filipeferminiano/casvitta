/**
 * Mock-mode only: hands a /cadastro draft from casvitta.com.br to app.casvitta.com.br.
 * Hosts don't share sessionStorage, and personal data must not travel in URLs, so the draft is
 * kept in this server's memory under an opaque, single-use id that expires in 10 minutes.
 * Real authentication replaces this in Milestone 1.
 */
import { randomUUID } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import type { SignupDraft } from '@/domain/types';
import { USE_MOCKS } from '@/mocks/clock';

const TTL_MS = 10 * 60_000;
const store = new Map<string, { draft: SignupDraft; expiresAt: number }>();

function sweep() {
  const now = Date.now();
  for (const [id, entry] of store) if (entry.expiresAt < now) store.delete(id);
}

export async function POST(request: NextRequest) {
  if (!USE_MOCKS) return new NextResponse(null, { status: 404 });
  sweep();
  const draft = (await request.json()) as SignupDraft;
  if (!draft?.name || !draft.email) return NextResponse.json({ error: 'invalid' }, { status: 422 });
  const id = randomUUID();
  store.set(id, { draft, expiresAt: Date.now() + TTL_MS });
  return NextResponse.json({ id });
}

export async function GET(request: NextRequest) {
  if (!USE_MOCKS) return new NextResponse(null, { status: 404 });
  sweep();
  const id = request.nextUrl.searchParams.get('id') ?? '';
  const entry = store.get(id);
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  store.delete(id); // single use
  return NextResponse.json(entry.draft);
}
