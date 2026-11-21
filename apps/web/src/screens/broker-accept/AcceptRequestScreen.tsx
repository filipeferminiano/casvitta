'use client';

import { LoadingState, Panel } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

// Strict mode runs effects twice in development; a link is confirmed once.
let started = false;

/**
 * /corretor/aceitar-pedido#t=<token>: the link a broker gets when staff refer an owner request to
 * them (backoffice BO3). The token travels in the URL fragment and is confirmed by this script, so
 * email scanners that prefetch links cannot accept on the broker's behalf.
 */
export function AcceptRequestScreen() {
  const t = useTranslations('brokerAccept');
  const [state, setState] = useState<'checking' | 'accepted' | 'expired' | 'invalid'>('checking');

  useEffect(() => {
    if (started) return;
    started = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      if (!token) {
        setState('invalid');
        return;
      }
      const { data } = await api.POST('/v1/public/capture-assignments/accept', {
        body: { token },
      });
      setState(data ? data.status : 'invalid');
    })();
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="type-display-l">{t('title')}</h1>
      {state === 'checking' ? (
        <LoadingState title={t('checking')} />
      ) : (
        <Panel>
          <div role="status" className="flex flex-col gap-2">
            <h2 className="type-title">{t(`${state}Title`)}</h2>
            <p className="type-body text-fg-strong">{t(`${state}Body`)}</p>
          </div>
        </Panel>
      )}
    </div>
  );
}
