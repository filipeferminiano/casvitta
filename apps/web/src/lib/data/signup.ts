/**
 * Broker signup (/cadastro) and sign-in (/entrar).
 *
 * Live ('accounts' area, see lib/live.ts): the account is created when the email link is
 * confirmed; each step saves to the API; the last step moves the session to the app host with a
 * one-time handoff code.
 * Demo: the draft lives in this host's store until the last step hands it to the app host (see
 * app/api/dev/signup-handoff).
 */
import { isApiError, type components } from '@casvitta/api-client';

import { isPlanKey, type PlanKey } from '@/config/catalog';
import type { SignupDraft, SignupStep } from '@/domain/types';
import { api } from '@/lib/api';
import { isLive } from '@/lib/live';
import { now } from '@/mocks/clock';

import { db, mutate, newId } from './store';

export const SIGNUP_STEPS: SignupStep[] = [
  'conta',
  'creci',
  'whatsapp',
  'plano',
  'primeiro-imovel',
];
const CURRENT_KEY = 'casvitta.signup.current';
const PLAN_KEY = 'casvitta.signup.plan';
const CHANGE_EVENT = 'casvitta:signup';

/** "000.000-F" style: 3 + 3 digits; the kind (F/J) is chosen apart. */
export const CRECI_NUMBER = /^\d{3}\.?\d{3}$/;
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Me = components['schemas']['MeOut'];

const emitChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

/** Typed result of an API call: field errors keyed by field name, or a general message. */
export type SaveResult =
  { ok: true } | { ok: false; message: string; fields: Record<string, string> };

function failure(error: unknown): SaveResult {
  if (!isApiError(error)) return { ok: false, message: '', fields: {} };
  const fields: Record<string, string> = {};
  for (const f of error.error.fields ?? []) fields[f.path.at(-1) ?? ''] = f.message;
  return { ok: false, message: error.error.message, fields };
}

// ------------------------------------------------------------------ live draft (from /me)

let liveDraft: SignupDraft | null = null;
let liveStatus: 'idle' | 'loading' | 'done' = 'idle';

function draftFromMe(me: Me): SignupDraft {
  const b = me.broker;
  return {
    id: me.user.id,
    name: me.user.name,
    email: me.user.email,
    creciName: b?.creci_name ?? null,
    // The API returns "000.000-F"; the form edits the 6 digits and the kind apart.
    creciNumber: b?.creci_number ?? null,
    creciState: b?.creci_state ?? 'SP',
    creciKind: b?.creci_kind ?? 'F',
    creciStatus: b?.creci_status ?? 'missing',
    whatsappE164: b?.whatsapp_e164 ?? null,
    plan: me.workspace.plan,
    createdAt: '',
  };
}

async function loadLiveDraft(): Promise<void> {
  liveStatus = 'loading';
  const { data } = await api.GET('/v1/me');
  liveDraft = data ? draftFromMe(data) : null;
  if (liveDraft) {
    const usage = await api.GET('/v1/me/plan');
    const requested = usage.data?.open_request?.requested_plan;
    liveDraft.requestedPlan = isPlanKey(requested) ? requested : null;
  }
  liveStatus = 'done';
  emitChange();
}

// ------------------------------------------------------------------ the draft, for screens
// (the React hook is in ./use-signup-draft.ts so server components can import this module)

export function subscribeSignup(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export const NOT_READY = '\u0000not-ready';

/** Stable snapshot (JSON) of the signup in progress: '' when none, NOT_READY while loading. */
export function signupSnapshot(): string {
  if (isLive('accounts')) {
    if (liveStatus !== 'done') return NOT_READY;
    return liveDraft ? JSON.stringify(liveDraft) : '';
  }
  const draft = currentSignup();
  return draft ? JSON.stringify(draft) : '';
}

/** Live mode: loads the account once per page (the hook calls it on mount). */
export function ensureSignupLoaded(): void {
  if (isLive('accounts') && liveStatus === 'idle') void loadLiveDraft();
}

/** Demo store draft (null in live mode). */
export function currentSignup(): SignupDraft | null {
  if (typeof window === 'undefined' || isLive('accounts')) return null;
  const id = window.sessionStorage.getItem(CURRENT_KEY);
  return id ? (db().signups[id] ?? null) : null;
}

/** Plan picked on a landing or prices page (?plano=essential) before the account exists. */
export function rememberPlan(plan: PlanKey): void {
  window.sessionStorage.setItem(PLAN_KEY, plan);
}

/** The plan to ask for at signup; old links (?plano=corretor) mean Essencial. Default Grátis. */
export function rememberedPlan(): PlanKey {
  if (typeof window === 'undefined') return 'free';
  const saved = window.sessionStorage.getItem(PLAN_KEY);
  if (saved === 'corretor') return 'essential';
  return isPlanKey(saved) ? saved : 'free';
}

// ------------------------------------------------------------------ steps

/** "Conta" (live): emails a link. Same answer whether or not the address has an account. */
export async function requestEmailLink(input: {
  intent: 'sign_in' | 'sign_up';
  email: string;
  name?: string;
}): Promise<SaveResult> {
  const { error } = await api.POST('/v1/auth/email-link', {
    body: {
      intent: input.intent,
      email: input.email,
      name: input.name || null,
      plan: input.intent === 'sign_up' ? rememberedPlan() : null,
    },
  });
  return error ? failure(error) : { ok: true };
}

/** Demo: the "link" is opened right away and the draft starts. */
export function startDemoSignup(name: string, email: string): SignupDraft {
  const draft: SignupDraft = {
    id: newId('signup'),
    name,
    email,
    creciName: null,
    creciNumber: null,
    creciState: 'SP',
    creciKind: 'F',
    creciStatus: 'missing',
    whatsappE164: null,
    plan: 'free',
    requestedPlan: rememberedPlan() === 'free' ? null : rememberedPlan(),
    createdAt: now().toISOString(),
  };
  mutate((data) => {
    data.signups[draft.id] = draft;
  });
  window.sessionStorage.setItem(CURRENT_KEY, draft.id);
  emitChange();
  return draft;
}

function updateDemo(patch: Partial<SignupDraft>): void {
  const current = currentSignup();
  if (!current) throw new Error('No signup in progress');
  mutate((data) => {
    data.signups[current.id] = { ...current, ...patch };
  });
  emitChange();
}

/** CRECI step: stored as pending; staff verify it later (CLAUDE.md rule 1). */
export async function saveCreci(input: {
  name: string;
  number: string;
  state: string;
  kind: 'F' | 'J';
}): Promise<SaveResult> {
  const digits = input.number.replace(/\D/g, '');
  if (!isLive('accounts')) {
    updateDemo({
      creciName: input.name,
      creciNumber: `${digits.slice(0, 3)}.${digits.slice(3)}-${input.kind}`,
      creciState: input.state,
      creciKind: input.kind,
      creciStatus: 'pending',
    });
    return { ok: true };
  }
  const { error } = await api.PATCH('/v1/me/broker-profile', {
    body: {
      creci_name: input.name,
      creci_number: digits,
      creci_state: input.state,
      creci_kind: input.kind,
    },
  });
  if (error) return failure(error);
  await loadLiveDraft();
  return { ok: true };
}

export async function saveWhatsApp(whatsappE164: string): Promise<SaveResult> {
  if (!isLive('accounts')) {
    updateDemo({ whatsappE164 });
    return { ok: true };
  }
  const { error } = await api.PATCH('/v1/me/broker-profile', { body: { whatsapp: whatsappE164 } });
  if (error) return failure(error);
  await loadLiveDraft();
  return { ok: true };
}

/**
 * Grátis needs nothing. A paid plan becomes a plan request that the Casvitta team confirms
 * (no billing yet): the account keeps working on Grátis meanwhile, and nothing is charged.
 */
export async function savePlan(plan: PlanKey): Promise<SaveResult> {
  const requestedPlan = plan === 'free' ? null : plan;
  if (!isLive('accounts')) {
    if (currentSignup()) updateDemo({ requestedPlan });
    else rememberPlan(plan);
    return { ok: true };
  }
  if (!liveDraft) {
    rememberPlan(plan); // before the account exists
    return { ok: true };
  }
  if (requestedPlan === null) {
    if (liveDraft.requestedPlan) {
      const usage = await api.GET('/v1/me/plan');
      const id = usage.data?.open_request?.id;
      if (id)
        await api.DELETE('/v1/me/plan/requests/{request_id}', {
          params: { path: { request_id: id } },
        });
    }
  } else if (requestedPlan !== liveDraft.requestedPlan) {
    const { error } = await api.POST('/v1/me/plan/requests', {
      body: {
        kind: 'plan',
        requested_plan: requestedPlan,
        billing_period: 'monthly',
        source: 'signup',
      },
    });
    if (error) return failure(error);
  }
  await loadLiveDraft();
  return { ok: true };
}

/**
 * Opens `next` on the app host with this session. Live: a one-time handoff code (60 s).
 * Demo: the draft is handed over through app/api/dev/signup-handoff.
 */
export async function openAppWithSession(appOrigin: string, next: string): Promise<string> {
  if (isLive('accounts')) {
    const { data } = await api.POST('/v1/auth/handoff');
    if (!data) throw new Error('handoff failed');
    const params = new URLSearchParams({ code: data.code, next });
    return `${appOrigin}/api/session/continue?${params}`;
  }
  const draft = currentSignup();
  if (!draft) return `${appOrigin}${next}`;
  const response = await fetch('/api/dev/signup-handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw new Error('handoff failed');
  const { id } = (await response.json()) as { id: string };
  return `${appOrigin}${next}?cadastro=${encodeURIComponent(id)}`;
}

/** Demo, app host: apply a handed-off signup to the demo workspace (pending CRECI blocks). */
export async function claimHandoff(id: string): Promise<boolean> {
  const response = await fetch(`/api/dev/signup-handoff?id=${encodeURIComponent(id)}`);
  if (!response.ok) return false;
  const draft = (await response.json()) as SignupDraft;
  mutate((data) => {
    const firstName = draft.name.split(' ')[0] ?? draft.name;
    data.broker = {
      ...data.broker,
      displayName: draft.name,
      firstName,
      creciNumber: draft.creciNumber ?? data.broker.creciNumber,
      creciState: draft.creciState ?? data.broker.creciState,
      creciVerifiedAt: draft.creciStatus === 'verified' ? now().toISOString() : null,
      phoneE164: draft.whatsappE164 ?? data.broker.phoneE164,
      plan: draft.plan,
    };
  });
  return true;
}

/** Live: confirms the emailed link (token from the URL fragment) and starts the session. */
export async function confirmEmailLink(
  token: string,
): Promise<{ ok: true; intent: 'sign_in' | 'sign_up' } | { ok: false }> {
  const { data } = await api.POST('/v1/auth/confirm', { body: { token } });
  return data ? { ok: true, intent: data.intent } : { ok: false };
}

export async function signOut(): Promise<void> {
  await api.POST('/v1/auth/sign-out');
}
