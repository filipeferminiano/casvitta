/**
 * Broker signup (/cadastro) in mock mode. The draft lives in the marketplace host's store until
 * the last step hands it to the app host (see app/api/dev/signup-handoff). Real auth: Milestone 1.
 */
import type { SignupDraft, SignupStep } from '@/domain/types';
import { now } from '@/mocks/clock';

import { db, mutate, newId } from './store';

export const SIGNUP_STEPS: SignupStep[] = [
  'conta',
  'creci',
  'whatsapp',
  'plano',
  'primeiro-imovel',
];
/** Demo verification code shown only in mock mode. */
export const MOCK_OTP = '123456';
const CURRENT_KEY = 'casvitta.signup.current';
const CHANGE_EVENT = 'casvitta:signup';

const emitChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

/** For useSyncExternalStore: re-render when the draft changes. */
export function subscribeSignup(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Stable snapshot (a JSON string) of the current draft; '' when there is none. */
export function signupSnapshot(): string {
  const draft = currentSignup();
  return draft ? JSON.stringify(draft) : '';
}

/** "000.000-F" style: 3 + 3 digits; the kind (F/J) is chosen apart. */
export const CRECI_NUMBER = /^\d{3}\.?\d{3}$/;

export function verifyOtp(code: string): boolean {
  return code.replace(/\D/g, '') === MOCK_OTP;
}

export function currentSignup(): SignupDraft | null {
  if (typeof window === 'undefined') return null;
  const id = window.sessionStorage.getItem(CURRENT_KEY);
  return id ? (db().signups[id] ?? null) : null;
}

const PLAN_KEY = 'casvitta.signup.plan';

/** Plan picked on /para-corretores before the account exists. */
export function rememberPlan(plan: 'essencial' | 'profissional'): void {
  window.sessionStorage.setItem(PLAN_KEY, plan);
}

export function startSignup(name: string, phoneE164: string): SignupDraft {
  const draft: SignupDraft = {
    id: newId('signup'),
    name,
    phoneE164,
    phoneVerified: true,
    creciName: null,
    creciNumber: null,
    creciState: 'SP',
    creciKind: 'F',
    creciStatus: 'missing',
    whatsappE164: null,
    plan: window.sessionStorage.getItem(PLAN_KEY) === 'essencial' ? 'essencial' : 'profissional',
    createdAt: now().toISOString(),
  };
  mutate((data) => {
    data.signups[draft.id] = draft;
  });
  window.sessionStorage.setItem(CURRENT_KEY, draft.id);
  emitChange();
  return draft;
}

export function updateSignup(patch: Partial<SignupDraft>): SignupDraft {
  const current = currentSignup();
  if (!current) throw new Error('No signup in progress');
  const next = mutate((data) => {
    const updated = { ...current, ...patch };
    data.signups[current.id] = updated;
    return updated;
  });
  emitChange();
  return next;
}

/** CRECI step: stores it as pending; staff verify it later (CLAUDE.md rule 1). */
export function submitCreci(input: {
  name: string;
  number: string;
  state: string;
  kind: 'F' | 'J';
}): SignupDraft {
  const digits = input.number.replace(/\D/g, '');
  return updateSignup({
    creciName: input.name,
    creciNumber: `${digits.slice(0, 3)}.${digits.slice(3)}-${input.kind}`,
    creciState: input.state,
    creciKind: input.kind,
    creciStatus: 'pending',
  });
}

/** Last step: hand the draft to the app host and return the URL to open there. */
export async function handoffToApp(appOrigin: string): Promise<string> {
  const draft = currentSignup();
  if (!draft) throw new Error('No signup in progress');
  const response = await fetch('/api/dev/signup-handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw new Error('handoff failed');
  const { id } = (await response.json()) as { id: string };
  return `${appOrigin}/anuncios/novo?cadastro=${encodeURIComponent(id)}`;
}

/** App host: apply a handed-off signup to the demo workspace (pending CRECI blocks publishing). */
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
      phoneE164: draft.whatsappE164 ?? draft.phoneE164,
      plan: draft.plan,
    };
  });
  return true;
}
