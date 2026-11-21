'use client';

import {
  CurrencyInput,
  FinancingSimulation,
  IncomeNeededResult,
  SegmentedControl,
  Select,
  StickyResultBar,
} from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SimulationBadge } from '@/components/badges';
import type { FinancingPage } from '@/lib/data/market';
import { formatBRL, formatBRLShort } from '@/lib/format';
import { monthlyRate, priceInstallment, sacFirstInstallment } from '@/lib/finance';
import { formatIncome } from '@/lib/market-format';

const TERMS = [120, 180, 240, 300, 360, 420];

export type CalculatorDefaults = {
  priceCents: number;
  downPaymentPct: number;
  minDownPaymentPct: number;
  termMonths: number;
  annualRateBps: number;
  maxIncomePct: number;
};

export type SimulationResult = {
  principalCents: number;
  firstPaymentCents: number;
  lastPaymentCents: number;
  totalInterestCents: number;
  minIncomeCents: number;
};

/**
 * Mirrors apps/api core/finance.py: SAC amortization split evenly (remainder first), Price with a
 * constant payment, interest rounded half up each month, last payment closes the balance.
 * The first payment and minimum income match exactly (finance.parity.test.ts); last payment and
 * total interest can differ by cents after 30 years of float math, and are shown rounded.
 */
export function computeSimulation(input: {
  priceCents: number;
  downPaymentCents: number;
  fgtsCents: number;
  termMonths: number;
  annualRateBps: number;
  system: 'sac' | 'price';
  maxIncomePct: number;
}): SimulationResult | null {
  const principal = Math.max(0, input.priceCents - input.downPaymentCents - input.fgtsCents);
  if (principal === 0) return null;
  const rate = monthlyRate(input.annualRateBps);
  const months = input.termMonths;
  const first =
    input.system === 'sac'
      ? sacFirstInstallment(principal, input.annualRateBps, months)
      : priceInstallment(principal, input.annualRateBps, months);
  let balance = principal;
  let totalPaid = 0;
  let last = first;
  const base = Math.floor(principal / months);
  const remainder = principal - base * months;
  for (let n = 1; n <= months; n += 1) {
    const interest = Math.round(balance * rate);
    let amortization: number;
    if (input.system === 'sac') amortization = base + (n <= remainder ? 1 : 0);
    else amortization = n === months ? balance : first - interest;
    if (n === months) amortization = balance;
    last = amortization + interest;
    totalPaid += last;
    balance -= amortization;
  }
  return {
    principalCents: principal,
    firstPaymentCents: first,
    lastPaymentCents: last,
    totalInterestCents: totalPaid - principal,
    minIncomeCents: Math.ceil((first * 100) / input.maxIncomePct),
  };
}

export function FinancingCalculator({
  defaults,
  neighborhood,
  initial,
}: {
  defaults: CalculatorDefaults;
  neighborhood: string;
  /** The server's simulations (core/finance.py) for the untouched defaults. */
  initial: FinancingPage['simulations'];
}) {
  const t = useTranslations('market.financing.calculator');
  const [price, setPrice] = useState<number | null>(defaults.priceCents);
  const [down, setDown] = useState<number | null>(
    Math.floor((defaults.priceCents * defaults.downPaymentPct) / 100),
  );
  const [fgts, setFgts] = useState<number | null>(0);
  const [term, setTerm] = useState(defaults.termMonths);
  const [system, setSystem] = useState<'sac' | 'price'>('sac');
  const [edited, setEdited] = useState(false);

  const priceCents = price ?? 0;
  const downCents = down ?? 0;
  const downPct = priceCents ? Math.round((downCents / priceCents) * 100) : 0;
  const tooLow = priceCents > 0 && downCents * 100 < priceCents * defaults.minDownPaymentPct;
  const server = initial.find((s) => s.system === system);
  const result: SimulationResult | null =
    !edited && server
      ? {
          principalCents: server.principal_cents,
          firstPaymentCents: server.first_payment_cents,
          lastPaymentCents: server.last_payment_cents,
          totalInterestCents: server.total_interest_cents,
          minIncomeCents: server.min_income_cents,
        }
      : computeSimulation({
          priceCents,
          downPaymentCents: downCents,
          fgtsCents: fgts ?? 0,
          termMonths: term,
          annualRateBps: defaults.annualRateBps,
          system,
          maxIncomePct: defaults.maxIncomePct,
        });
  const rate = (defaults.annualRateBps / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const change =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setEdited(true);
      setter(v);
    };
  const invalid = tooLow
    ? t('downTooLow', { pct: defaults.minDownPaymentPct })
    : result
      ? undefined
      : t('nothingToFinance');

  return (
    <>
      <FinancingSimulation
        title={t('title')}
        badge={<SimulationBadge />}
        inputs={
          <div className="grid gap-3 sm:grid-cols-2">
            <CurrencyInput
              label={t('price')}
              value={price}
              onValueChange={change(setPrice)}
              help={edited ? t('priceEdited') : t('priceMedian', { name: neighborhood })}
            />
            <CurrencyInput
              label={t('downPayment')}
              value={down}
              onValueChange={change(setDown)}
              help={t('downPaymentHelp', { pct: downPct })}
              error={tooLow ? t('downTooLow', { pct: defaults.minDownPaymentPct }) : undefined}
            />
            <CurrencyInput
              label={t('fgts')}
              value={fgts}
              onValueChange={change(setFgts)}
              hint={t('optional')}
            />
            <Select
              label={t('term')}
              value={String(term)}
              onValueChange={(v) => change(setTerm)(Number(v))}
              options={TERMS.map((m) => ({
                value: String(m),
                label: t('termOption', { years: m / 12 }),
              }))}
            />
            <SegmentedControl
              label={t('system')}
              value={system}
              onValueChange={(v) => setSystem(v as 'sac' | 'price')}
              options={[
                { value: 'sac', label: t('sac') },
                { value: 'price', label: t('priceTable') },
              ]}
              className="sm:col-span-2"
            />
          </div>
        }
        result={
          <IncomeNeededResult
            title={t('minIncome')}
            badge={<SimulationBadge />}
            value={result && !tooLow ? formatIncome(result.minIncomeCents) : null}
            perMonth={t('perMonth')}
            summary={
              result && !tooLow
                ? t('summary', {
                    pct: defaults.maxIncomePct,
                    principal: formatBRL(result.principalCents),
                  })
                : undefined
            }
            installments={
              system === 'sac'
                ? {
                    system: 'sac',
                    first: {
                      label: t('firstSac'),
                      value: result ? formatBRL(result.firstPaymentCents) : '—',
                    },
                    last: {
                      label: t('lastSac'),
                      value: result ? formatBRL(result.lastPaymentCents) : '—',
                    },
                  }
                : {
                    system: 'price',
                    fixed: {
                      label: t('fixedPrice'),
                      value: result ? formatBRL(result.firstPaymentCents) : '—',
                    },
                  }
            }
            totalInterest={
              result
                ? {
                    label: t('totalInterest'),
                    value: formatBRLShort(roundThousands(result.totalInterestCents)),
                  }
                : undefined
            }
            rate={t('rate', { rate })}
            footnote={t('footnote')}
            invalidMessage={invalid}
          />
        }
        details={t('details', { rate, term: term / 12, pct: defaults.maxIncomePct })}
      />
      {result && !tooLow ? (
        <StickyResultBar
          label={t('minIncomeShort')}
          value={formatIncome(result.minIncomeCents)}
          suffix={t('perMonth')}
          action={{ label: t('seeDetails'), href: '#simulacao' }}
        />
      ) : null}
    </>
  );
}

/** Total interest over decades: shown to the thousand ("R$ 987 mil"). */
function roundThousands(cents: number): number {
  return Math.round(cents / 100_000) * 100_000;
}
