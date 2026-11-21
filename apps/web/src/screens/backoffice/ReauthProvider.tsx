'use client';

import { Button, Input } from '@casvitta/ui';
import { Dialog } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { requestReauthCode, useConfirmReauth, useStaffMe } from '@/lib/data/staff';
import { isReauthRequired } from '@/lib/staff-api';

type Run = <T>(action: () => Promise<T>) => Promise<T>;

const ReauthContext = createContext<Run | null>(null);

/**
 * Sensitive actions (reveal a contact, export, change roles, view as customer) need a recent proof
 * of identity. `useSensitive()(action)` runs the action; if the API answers "reauth_required" it
 * emails a 6-digit code, asks for it in a dialog and runs the action again once confirmed.
 */
export function ReauthProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('backoffice.reauth');
  const me = useStaffMe().data;
  const confirm = useConfirmReauth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const askForCode = useCallback(async () => {
    await requestReauthCode();
    setCode('');
    setError(null);
    setNotice(null);
    setOpen(true);
    return new Promise<void>((resolve, reject) => {
      pending.current = { resolve, reject };
    });
  }, []);

  const run: Run = useCallback(
    async (action) => {
      try {
        return await action();
      } catch (e) {
        if (!isReauthRequired(e)) throw e;
        await askForCode();
        return action();
      }
    },
    [askForCode],
  );

  const close = (next: boolean) => {
    if (next) return;
    setOpen(false);
    pending.current?.reject(new Error('reauth_cancelled'));
    pending.current = null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await confirm.mutateAsync(code);
      setOpen(false);
      pending.current?.resolve();
      pending.current = null;
    } catch {
      setError(t('invalid'));
    }
  };

  const resend = async () => {
    await requestReauthCode();
    setError(null);
    setNotice(t('sent'));
  };

  return (
    <ReauthContext.Provider value={run}>
      {children}
      <Dialog
        open={open}
        onOpenChange={close}
        title={t('title')}
        description={t('description', { email: me?.email ?? '' })}
        closeLabel={t('close')}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label={t('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            error={error ?? undefined}
            help={notice ?? undefined}
            inputClassName="font-mono tracking-[0.3em]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={resend}>
              {t('resend')}
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => close(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={code.length !== 6 || confirm.isPending}>
                {confirm.isPending ? t('confirming') : t('confirm')}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </ReauthContext.Provider>
  );
}

export function useSensitive(): Run {
  const run = useContext(ReauthContext);
  if (!run) throw new Error('useSensitive must be used inside <ReauthProvider>');
  return run;
}

export function isReauthCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === 'reauth_cancelled';
}
