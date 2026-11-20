'use client';

import { CurrencyInput, FinancingSimulation, SegmentedControl, Select } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SimulationBadge } from '@/components/badges';
import { formatBRL } from '@/lib/format';
import { priceInstallment, sacFirstInstallment } from '@/lib/finance';

const TERMS = [120, 180, 240, 300, 360, 420];

export type CalculatorDefaults = {
  priceCents: number;
  downPaymentPct: number;
  termMonths: number;
  annualRateBps: number;
  maxIncomePct: number;
};

/** Same math as apps/api core/finance.py (first installment), checked by finance.parity.test.ts. */
export function computeSimulation(input: {
  priceCents: number;
  downPaymentCents: number;
  fgtsCents: number;
  termMonths: number;
  annualRateBps: number;
  system: 'sac' | 'price';
  maxIncomePct: number;
}) {
  const principal = Math.max(0, input.priceCents - input.downPaymentCents - input.fgtsCents);
  if (principal === 0) return null;
  const first =
    input.system === 'sac'
      ? sacFirstInstallment(principal, input.annualRateBps, input.termMonths)
      : priceInstallment(principal, input.annualRateBps, input.termMonths);
  return {
    principalCents: principal,
    firstPaymentCents: first,
    minIncomeCents: Math.ceil((first * 100) / input.maxIncomePct),
  };
}

export function FinancingCalculator({
  defaults,
  neighborhood,
}: {
  defaults: CalculatorDefaults;
  neighborhood: string;
}) {
  const t = useTranslations('market.financing.calculator');
  const [price, setPrice] = useState<number | null>(defaults.priceCents);
  const [down, setDown] = useState<number | null>(
    Math.floor((defaults.priceCents * defaults.downPaymentPct) / 100),
  );
  const [fgts, setFgts] = useState<number | null>(0);
  const [term, setTerm] = useState(defaults.termMonths);
  const [system, setSystem] = useState<'sac' | 'price'>('sac');

  const priceCents = price ?? 0;
  const result = computeSimulation({
    priceCents,
    downPaymentCents: down ?? 0,
    fgtsCents: fgts ?? 0,
    termMonths: term,
    annualRateBps: defaults.annualRateBps,
    system,
    maxIncomePct: defaults.maxIncomePct,
  });
  const rate = (defaults.annualRateBps / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
  });
  const downPct = priceCents ? Math.round(((down ?? 0) / priceCents) * 100) : 0;

  return (
    <FinancingSimulation
      title={t('title', { name: neighborhood })}
      badge={<SimulationBadge />}
      context={t('context')}
      inputs={
        <div className="grid gap-3 sm:grid-cols-2">
          <CurrencyInput label={t('price')} value={price} onValueChange={setPrice} />
          <CurrencyInput
            label={t('downPayment')}
            value={down}
            onValueChange={setDown}
            help={t('downPaymentHelp', { pct: downPct })}
          />
          <CurrencyInput
            label={t('fgts')}
            value={fgts}
            onValueChange={setFgts}
            hint={t('optional')}
          />
          <Select
            label={t('term')}
            value={String(term)}
            onValueChange={(v) => setTerm(Number(v))}
            options={TERMS.map((m) => ({
              value: String(m),
              label: t('termOption', { years: m / 12, months: m }),
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
      resultLabel={t('minIncome', { pct: defaults.maxIncomePct })}
      result={
        <span data-testid="min-income">
          {result ? formatBRL(result.minIncomeCents) : t('nothingToFinance')}
        </span>
      }
      details={t('details', { rate, term, pct: defaults.maxIncomePct })}
      rows={
        result
          ? [
              {
                key: 'first',
                label: system === 'sac' ? t('firstSac') : t('firstPrice'),
                value: formatBRL(result.firstPaymentCents),
              },
              { key: 'principal', label: t('principal'), value: formatBRL(result.principalCents) },
              { key: 'rate', label: t('rate'), value: t('rateValue', { rate }) },
            ]
          : undefined
      }
    />
  );
}
