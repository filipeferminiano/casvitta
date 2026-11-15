/**
 * Mortgage simulation for the UI, mirroring apps/api/app/core/finance.py (SAC and Price).
 * Always a simulation: label every number "Simulação · não é aprovação".
 * Money in integer cents; rates in basis points (effective annual rate).
 */

export const ILLUSTRATIVE_ANNUAL_RATE_BPS = 1_150;
export const DEFAULT_TERM_MONTHS = 360;

export function monthlyRate(annualRateBps: number): number {
  return Math.pow(1 + annualRateBps / 10_000, 1 / 12) - 1;
}

/** First installment, SAC: constant amortization + interest on the full balance. */
export function sacFirstInstallment(
  principalCents: number,
  annualRateBps: number,
  months: number,
): number {
  const amortization = Math.ceil(principalCents / months);
  return amortization + Math.round(principalCents * monthlyRate(annualRateBps));
}

/** Constant installment, Price. */
export function priceInstallment(
  principalCents: number,
  annualRateBps: number,
  months: number,
): number {
  const i = monthlyRate(annualRateBps);
  if (i === 0) return Math.round(principalCents / months);
  const factor = Math.pow(1 + i, months);
  return Math.round((principalCents * i * factor) / (factor - 1));
}

export type Simulation = {
  principalCents: number;
  firstInstallmentCents: number;
  incomeShare: number | null; // 0.298 == 29,8 %
  annualRateBps: number;
  termMonths: number;
  downPaymentCents: number;
};

/** Down payment includes FGTS (as in the mockups: "entrada 20% com FGTS"). */
export function simulateSac(input: {
  priceCents: number;
  downPaymentCents: number;
  householdIncomeCents?: number | null;
  annualRateBps?: number;
  termMonths?: number;
}): Simulation {
  const annualRateBps = input.annualRateBps ?? ILLUSTRATIVE_ANNUAL_RATE_BPS;
  const termMonths = input.termMonths ?? DEFAULT_TERM_MONTHS;
  const principalCents = Math.max(0, input.priceCents - input.downPaymentCents);
  const first =
    principalCents > 0 ? sacFirstInstallment(principalCents, annualRateBps, termMonths) : 0;
  return {
    principalCents,
    firstInstallmentCents: first,
    incomeShare: input.householdIncomeCents ? first / input.householdIncomeCents : null,
    annualRateBps,
    termMonths,
    downPaymentCents: input.downPaymentCents,
  };
}
