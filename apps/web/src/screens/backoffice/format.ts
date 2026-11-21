'use client';

import { formatTime } from '@casvitta/ui';
import { useTranslations } from 'next-intl';

import { relativeAge } from '@/lib/format';

const TZ = 'America/Sao_Paulo';

/** The backoffice always uses the real clock (never the demo clock of the broker app). */
export function useAgo() {
  const t = useTranslations('time');
  return (iso: string | null | undefined, never: string) => {
    if (!iso) return never;
    const age = relativeAge(iso, new Date());
    return t(`ago.${age.key}`, { n: age.n });
  };
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
});

/** "20/11 09h41" (audit log, queues). */
export function formatDayTime(iso: string): string {
  const date = new Date(iso);
  return `${dayMonth.format(date)} ${formatTime(date)}`;
}

const longDay = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Sexta, 20 de novembro" (page headers). */
export function formatToday(date = new Date()): string {
  const text = longDay.format(date).replace('-feira', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Hours since an instant (SLA badges: "há 26 h"). */
export function hoursSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000));
}

/** Message keys cannot contain dots: "creci.verify" -> "creci_verify". */
export function messageKey(value: string): string {
  return value.replaceAll('.', '_');
}
