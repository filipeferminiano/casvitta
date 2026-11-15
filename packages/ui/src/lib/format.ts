/**
 * pt-BR formatting helpers. Money is integer cents.
 * BRL: whole amounts as "R$ 690.000", otherwise "R$ 6.563,40". Times "14h" / "14h03".
 */

const TIME_ZONE = 'America/Sao_Paulo';

const brlWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const brlCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Intl puts a non-breaking space after "R$"; keep it (prevents line breaks inside amounts). */
export function formatBRL(amountCents: number, options?: { showCents?: boolean }): string {
  if (!Number.isInteger(amountCents)) throw new Error('amountCents must be an integer');
  const showCents = options?.showCents ?? amountCents % 100 !== 0;
  return (showCents ? brlCents : brlWhole).format(amountCents / 100);
}

const centsInput = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Grouped with dots, two decimals: 656340 cents -> "6.563,40". */
export function formatCentsInput(amountCents: number): string {
  return centsInput.format(amountCents / 100);
}

const timeParts = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatTime(value: Date): string {
  const parts = Object.fromEntries(timeParts.formatToParts(value).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  return parts.minute === '00' ? `${hour}h` : `${hour}h${parts.minute}`;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDate(value: Date): string {
  return dateFormat.format(value);
}

/** "+5511927408912" -> "(11) 92740-8912". Returns the input unchanged if it is not a BR number. */
export function formatPhoneBR(e164: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}
