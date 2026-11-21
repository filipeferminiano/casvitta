/** Formatting for the price pages. Numbers arrive already rounded by the API. */
import { formatBRL, formatDate } from '@/lib/format';

/** "R$ 12.350/m²". */
export function formatPriceM2(cents: number): string {
  return `${formatBRL(cents)}/m²`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-07" -> "jul/2026". */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]}/${year}`;
}

/** "2026-08-31" -> "ago/2026" (window ends). */
export function formatWindowMonth(isoDate: string): string {
  return formatMonth(isoDate.slice(0, 7));
}

/** "2026-11-20T12:00:00Z" -> "20/11/2026" (São Paulo time). */
export function formatUpdated(isoDateTime: string): string {
  return formatDate(new Date(isoDateTime));
}

export function formatPct(value: number): string {
  return `${value}%`;
}

/** Built-area band from the API ("50-70") as "50 a 70 m²". */
export function formatAreaBand(
  min: number,
  max: number | null | undefined,
): {
  key: 'upTo' | 'between' | 'from';
  values: Record<string, number>;
} {
  if (!min) return { key: 'upTo', values: { max: max ?? 0 } };
  if (max == null) return { key: 'from', values: { min } };
  return { key: 'between', values: { min, max } };
}

/** "+1,8%" / "−3,4%" / "0,0%" (signed text, never color alone). */
export function formatChange(pct: number | string): string {
  const value = typeof pct === 'string' ? Number(pct) : pct;
  const text = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (value > 0) return `+${text}%`;
  if (value < 0) return `\u2212${text}%`;
  return `${text}%`;
}

/** Indicated income in whole reais, rounded up ("R$ 23.780"): a simulation, not a quote. */
export function formatIncome(cents: number): string {
  return formatBRL(Math.ceil(cents / 100) * 100);
}
