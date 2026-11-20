'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import type { SignupDraft } from '@/domain/types';

import { NOT_READY, ensureSignupLoaded, signupSnapshot, subscribeSignup } from './signup';

/** The signup in progress (null when none). `ready` is false until it is known. */
export function useSignupDraft(): { ready: boolean; draft: SignupDraft | null } {
  const value = useSyncExternalStore(subscribeSignup, signupSnapshot, () => NOT_READY);
  useEffect(ensureSignupLoaded, []);
  return useMemo(
    () => ({
      ready: value !== NOT_READY,
      draft: value && value !== NOT_READY ? (JSON.parse(value) as SignupDraft) : null,
    }),
    [value],
  );
}
