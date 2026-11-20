'use client';

import { Button, Panel } from '@casvitta/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { confirmEmailLink, openAppWithSession } from '@/lib/data/signup';

// Strict mode runs effects twice in development; a link works only once, so confirm once.
let started = false;

/** App host for this marketplace host: app.<root> (app.localhost in dev). */
function appOrigin(): string {
  const { protocol, host } = window.location;
  return `${protocol}//app.${host.replace(/^www\./, '')}`;
}

/**
 * /entrar/confirmar#t=<token>: the page the emailed link opens. The token travels in the URL
 * fragment, which never reaches a server log, and is confirmed by this page's script, so email
 * scanners that prefetch links cannot use it up.
 */
export function ConfirmLinkScreen() {
  const t = useTranslations('signIn.confirm');
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'invalid' | 'missing'>('checking');

  useEffect(() => {
    if (started) return;
    started = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      if (!token) {
        setState('missing');
        return;
      }
      const result = await confirmEmailLink(token);
      if (!result.ok) {
        setState('invalid');
        return;
      }
      if (result.intent === 'sign_up') {
        router.replace('/cadastro/creci');
        return;
      }
      try {
        window.location.assign(await openAppWithSession(appOrigin(), '/inicio'));
      } catch {
        setState('invalid');
      }
    })();
  }, [router]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="type-display-l">{t('title')}</h1>
      <Panel>
        {state === 'checking' ? (
          <p role="status" className="type-body text-fg-strong">
            {t('checking')}
          </p>
        ) : (
          <div role="alert" className="flex flex-col items-start gap-4">
            <p className="type-title">{t(state === 'invalid' ? 'invalidTitle' : 'missingTitle')}</p>
            <p className="type-body text-fg-strong">{t(state)}</p>
            <Button asChild>
              <Link href="/entrar">{t('requestNew')}</Link>
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
