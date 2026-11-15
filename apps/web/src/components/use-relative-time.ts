'use client';

import { useTranslations } from 'next-intl';

import { relativeAge } from '@/lib/format';
import { now } from '@/mocks/clock';

/** ago: "há 8 min", "há 2 h"; short: "8 min", "2 h"; list: "há 8 min", "2 h". */
export function useRelativeTime() {
  const t = useTranslations('time');
  return (iso: string, style: 'ago' | 'short' | 'list' = 'ago') => {
    const age = relativeAge(iso, now());
    return t(`${style}.${age.key}`, { n: age.n });
  };
}
