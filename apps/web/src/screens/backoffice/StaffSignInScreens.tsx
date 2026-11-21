'use client';

import { Button, Callout, Input, LoadingState, LogoMark, Panel } from '@casvitta/ui';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { EMAIL } from '@/lib/data/signup';
import { confirmStaffLink, requestStaffLink } from '@/lib/data/staff';

function Frame({ children }: { children: ReactNode }) {
  const t = useTranslations('backoffice.shell');
  return (
    <div className="flex min-h-dvh items-start justify-center bg-canvas px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-control bg-ink-900">
            <LogoMark tone="white" size={20} title={null} />
          </span>
          <span className="text-[15px] font-bold tracking-[0.02em]">{t('brand')}</span>
          <span className="rounded-chip bg-attention px-1.5 py-0.5 font-mono text-[10px] leading-4 tracking-[0.06em]">
            {t('badge')}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** /entrar on the admin host: email link, only for allowlisted staff (same answer for all). */
export function StaffSignInScreen() {
  const t = useTranslations('backoffice.signIn');
  const expired = useSearchParams().get('sessao') === 'expirada';
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) {
      setError(t('invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestStaffLink(value);
      setSentTo(value);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <h1 className="type-display-l">{t('title')}</h1>
      {expired && !sentTo ? <Callout tone="attention">{t('sessionExpired')}</Callout> : null}
      <Panel>
        {sentTo ? (
          <div className="flex flex-col gap-4" role="status">
            <h2 className="type-title">{t('sentTitle')}</h2>
            <p className="type-body text-fg-strong">{t('sentDescription', { email: sentTo })}</p>
            <Button variant="secondary" onClick={() => setSentTo(null)}>
              {t('again')}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <p className="type-body text-fg-strong">{t('description')}</p>
            <Input
              label={t('email')}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" loading={busy} loadingLabel={t('sending')}>
              {t('submit')}
            </Button>
          </form>
        )}
      </Panel>
    </Frame>
  );
}

// Strict mode runs effects twice in development; a link works only once, so confirm once.
let started = false;

/**
 * /entrar/confirmar#t=<token>: the token travels in the URL fragment (never in server logs) and
 * is confirmed by script, so email scanners that prefetch links cannot use it up.
 */
export function StaffConfirmScreen() {
  const t = useTranslations('backoffice.confirm');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started) return;
    started = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      if (!token) {
        setFailed(true);
        return;
      }
      try {
        await confirmStaffLink(token);
        window.location.replace('/');
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  return (
    <Frame>
      {failed ? (
        <Panel>
          <div className="flex flex-col gap-4" role="alert">
            <h1 className="type-title">{t('failedTitle')}</h1>
            <p className="type-body text-fg-strong">{t('failedDescription')}</p>
            <Button asChild>
              <a href="/entrar">{t('again')}</a>
            </Button>
          </div>
        </Panel>
      ) : (
        <LoadingState title={t('checking')} />
      )}
    </Frame>
  );
}
