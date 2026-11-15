'use client';

import { useTranslations } from 'next-intl';

import { relativeAge } from '@/lib/format';
import { now } from '@/mocks/clock';

/** "há 8 min", "há 2 h", "ontem", "há 3 dias". */
export function useRelativeTime() {
  const t = useTranslations('time');
  return (iso: string, style: 'ago' | 'short' = 'ago') => {
    const age = relativeAge(iso, now());
    return t(`${style}.${age.key}`, { n: age.n });
  };
}
