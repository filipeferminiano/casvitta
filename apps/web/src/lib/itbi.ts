/**
 * ITBI estimate in the browser, mirroring apps/api core/itbi.py (checked by itbi.parity.test.ts).
 * Rules come from the API (configured, with a "reviewed" flag); the result is an estimate.
 */
export type ItbiRules = {
  rate_bps: number;
  sfh_rate_bps: number;
  sfh_limit_cents: number | null;
};

export type ItbiPart = {
  kind: 'financed_sfh' | 'general';
  baseCents: number;
  rateBps: number;
  taxCents: number;
};

export type ItbiResult = {
  baseCents: number;
  baseIsVenal: boolean;
  parts: ItbiPart[];
  totalCents: number;
};

/** Half up, like Decimal.quantize(ROUND_HALF_UP) for positive amounts. */
const tax = (base: number, bps: number) => Math.floor((base * bps) / 10_000 + 0.5);

export function computeItbi(
  rules: ItbiRules,
  input: {
    priceCents: number;
    venalCents?: number | null;
    financedCents?: number | null;
    sfh?: boolean;
  },
): ItbiResult | null {
  if (!input.priceCents || input.priceCents <= 0) return null;
  const venal = input.venalCents ?? 0;
  const base = Math.max(input.priceCents, venal);
  const parts: ItbiPart[] = [];
  let reduced = 0;
  if (input.sfh && input.financedCents) {
    reduced = Math.min(input.financedCents, base);
    if (rules.sfh_limit_cents != null) reduced = Math.min(reduced, rules.sfh_limit_cents);
    parts.push({
      kind: 'financed_sfh',
      baseCents: reduced,
      rateBps: rules.sfh_rate_bps,
      taxCents: tax(reduced, rules.sfh_rate_bps),
    });
  }
  const rest = base - reduced;
  if (rest > 0) {
    parts.push({
      kind: 'general',
      baseCents: rest,
      rateBps: rules.rate_bps,
      taxCents: tax(rest, rules.rate_bps),
    });
  }
  return {
    baseCents: base,
    baseIsVenal: venal > input.priceCents,
    parts,
    totalCents: parts.reduce((sum, p) => sum + p.taxCents, 0),
  };
}
