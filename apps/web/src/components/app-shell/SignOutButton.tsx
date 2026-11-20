'use client';

import { Button } from '@casvitta/ui';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { signOut } from '@/lib/data/signup';
import { isLive } from '@/lib/live';

/** Ends the session (all devices of this login) and goes back to casvitta.com.br. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('nav');
  const [busy, setBusy] = useState(false);
  if (!isLive('accounts')) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      loading={busy}
      loadingLabel={t('signingOut')}
      className={compact ? 'justify-center lg:justify-start' : undefined}
      onClick={async () => {
        setBusy(true);
        await signOut();
        const { protocol, host } = window.location;
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- other host
        window.location.assign(`${protocol}//${host.replace(/^app\./, '')}/`);
      }}
    >
      <LogOut aria-hidden="true" strokeWidth={1.6} className="size-5 shrink-0" />
      <span className={compact ? 'sr-only lg:not-sr-only' : undefined}>{t('signOut')}</span>
    </Button>
  );
}
