'use client';

import { Button, Callout, Panel } from '@casvitta/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AccountStep } from './AccountStep';

/** /entrar: email link sign-in (same "Conta" step as /cadastro, without the name). */
export function SignInScreen() {
  const t = useTranslations('signIn');
  const params = useSearchParams();
  const [demoDone, setDemoDone] = useState(false);
  const appUrl =
    typeof window === 'undefined'
      ? '/inicio'
      : `${window.location.protocol}//app.${window.location.host.replace(/^www\./, '')}/inicio`;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="type-display-l">{t('title')}</h1>
      {params.get('sessao') === 'expirada' ? (
        <Callout tone="attention">{t('sessionExpired')}</Callout>
      ) : null}
      <Panel>
        {demoDone ? (
          <div className="flex flex-col gap-4">
            <Callout>{t('mockSignedIn')}</Callout>
            <Button asChild>
              <a href={appUrl}>{t('openApp')}</a>
            </Button>
          </div>
        ) : (
          <AccountStep
            intent="sign_in"
            submitLabel={t('submit')}
            onDemoConfirmed={() => setDemoDone(true)}
          />
        )}
      </Panel>
      <p className="type-body-s text-fg-strong">
        {t('noAccount')}{' '}
        <Link
          href="/cadastro/conta"
          className="font-semibold text-action underline underline-offset-2"
        >
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
