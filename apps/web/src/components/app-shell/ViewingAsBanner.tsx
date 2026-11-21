'use client';

import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { signOut } from '@/lib/data/signup';
import { api } from '@/lib/api';
import { isLive } from '@/lib/live';

/**
 * Shown when a Casvitta staff member opened this account read-only from the backoffice ("Ver
 * como o cliente"). The API refuses every change in that session; this banner says so.
 */
export function ViewingAsBanner() {
  const t = useTranslations('nav');
  const me = useQuery({
    queryKey: ['me-session'],
    enabled: isLive('accounts'),
    staleTime: 60_000,
    queryFn: async () => (await api.GET('/v1/me')).data ?? null,
  });
  const staff = me.data?.viewing_as;
  if (!staff) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-ink-900 px-4 py-2 type-body-s text-white"
    >
      <Eye aria-hidden="true" className="size-4" />
      <span>{t('viewingAs', { name: staff })}</span>
      <button
        type="button"
        className="min-h-11 rounded-control px-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
        onClick={async () => {
          await signOut();
          window.close();
        }}
      >
        {t('viewingAsLeave')}
      </button>
    </div>
  );
}
