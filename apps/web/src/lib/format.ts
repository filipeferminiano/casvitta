/** pt-BR formatting for screens (São Paulo time). Money in integer cents. */
export { formatBRL, formatDate, formatPhoneBR, formatTime } from '@casvitta/ui';

const TZ = 'America/Sao_Paulo';

/** 67_200_000 -> "R$ 672 mil"; 6_000_000 -> "R$ 60 mil"; 4_032_000 -> "R$ 40.320" (not whole thousands stays exact). */
export function formatBRLShort(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 10_000 && reais % 1000 === 0) {
    return `R$ ${new Intl.NumberFormat('pt-BR').format(reais / 1000)} mil`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(reais);
}

/** "Segunda, 16 de novembro". */
export function formatLongDay(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const text = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(date)
    .replace('-feira', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Seg 16". */
export function formatWeekdayShort(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' })
    .format(date)
    .replace('.', '');
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric' }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}`;
}

/** "16/11". */
export function formatDayMonth(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

/** "5/11" (no zero padding, for chart axes). */
export function formatDayMonthCompact(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${Number(get('day'))}/${Number(get('month'))}`;
}

/** Day of month only: "5". */
export function formatDayOfMonth(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric' }).format(date);
}

/** "14 nov". */
export function formatDayMonthShort(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'short' })
    .format(date)
    .replace('.', '');
  return `${day} ${month}`;
}

/** "16 de novembro". */
export function formatDayMonthLong(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'long' }).format(
    date,
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/** 0.298 -> "29,8%". */
export function formatPercent(ratio: number, digits = 1): string {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio * 100)}%`;
}

/** 1150 bps -> "11,5%". */
export function formatRateBps(bps: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(bps / 100)}%`;
}

export type RelativeUnit = { key: 'now' | 'minutes' | 'hours' | 'yesterday' | 'days'; n: number };

/** Relative age used across the app; the label comes from the catalog (time.*). */
export function relativeAge(iso: string, now: Date): RelativeUnit {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return { key: 'now', n: 0 };
  if (minutes < 60) return { key: 'minutes', n: minutes };
  const hours = Math.floor(minutes / 60);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
  if (day === today) return { key: 'hours', n: hours };
  const days = Math.round(
    (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${day}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  return days === 1 ? { key: 'yesterday', n: 1 } : { key: 'days', n: days };
}
