'use client';

import {
  BreakdownTable,
  CurrencyInput,
  SegmentedControl,
  StickyResultBar,
  TaxCalculatorCard,
} from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { formatBRL } from '@/lib/format';
import { computeItbi, type ItbiRules } from '@/lib/itbi';

const pct = (bps: number) =>
  (bps / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 02 · calculator card. Estimate only: the official value is on the Prefeitura's guide. */
export function ItbiCalculator({
  rules,
  reviewMarker,
  registry,
}: {
  rules: ItbiRules;
  reviewMarker?: string;
  registry?: { low: number; high: number } | null;
}) {
  const t = useTranslations('market.itbi.calculator');
  const [price, setPrice] = useState<number | null>(null);
  const [venal, setVenal] = useState<number | null>(null);
  const [financing, setFinancing] = useState<'nao' | 'sim'>('nao');
  const [financed, setFinanced] = useState<number | null>(null);
  const [system, setSystem] = useState<'sfh' | 'outro'>('sfh');
  const [touched, setTouched] = useState(false);

  const result = computeItbi(rules, {
    priceCents: price ?? 0,
    venalCents: venal,
    financedCents: financing === 'sim' ? financed : null,
    sfh: financing === 'sim' && system === 'sfh',
  });
  const missingPrice = touched && !price;

  return (
    <>
      <TaxCalculatorCard
        title={t('title')}
        rateChip={t('rateChip', { rate: pct(rules.rate_bps) })}
        reviewMarker={reviewMarker}
        state={result ? 'result' : 'empty'}
        resultLabel={t('resultLabel')}
        total={result ? formatBRL(result.totalCents) : undefined}
        emptyHint={t('emptyHint')}
        resultId="itbi-total"
        base={
          result
            ? t(result.baseIsVenal ? 'baseVenal' : 'basePrice', {
                base: formatBRL(result.baseCents),
              })
            : undefined
        }
        breakdown={
          result ? (
            <BreakdownTable
              caption={t('breakdownCaption')}
              rows={result.parts.map((p) => ({
                key: p.kind,
                label: t(`parts.${p.kind}`),
                formula: `${formatBRL(p.baseCents)} × ${pct(p.rateBps)}%`,
                amount: formatBRL(p.taxCents),
              }))}
              totalLabel={t('total')}
              total={formatBRL(result.totalCents)}
            />
          ) : undefined
        }
        disclaimer={t('disclaimer')}
        extra={
          result && registry
            ? t('registry', { low: formatBRL(registry.low), high: formatBRL(registry.high) })
            : undefined
        }
      >
        <div className="grid gap-3" onBlur={() => setTouched(true)}>
          <CurrencyInput
            label={t('price')}
            value={price}
            onValueChange={setPrice}
            error={missingPrice ? t('priceRequired') : undefined}
          />
          <CurrencyInput
            label={t('venal')}
            value={venal}
            onValueChange={setVenal}
            hint={t('optional')}
            help={t('venalHelp')}
          />
          <SegmentedControl
            label={t('financing')}
            value={financing}
            onValueChange={(v) => setFinancing(v as 'nao' | 'sim')}
            options={[
              { value: 'nao', label: t('no') },
              { value: 'sim', label: t('yes') },
            ]}
          />
          {financing === 'sim' ? (
            <>
              <CurrencyInput label={t('financed')} value={financed} onValueChange={setFinanced} />
              <SegmentedControl
                label={t('system')}
                value={system}
                onValueChange={(v) => setSystem(v as 'sfh' | 'outro')}
                options={[
                  { value: 'sfh', label: t('sfh') },
                  { value: 'outro', label: t('other') },
                ]}
              />
            </>
          ) : null}
        </div>
      </TaxCalculatorCard>
      {result ? (
        <StickyResultBar
          label={t('resultLabel')}
          value={formatBRL(result.totalCents)}
          action={{ label: t('seeDetails'), href: '#itbi-total' }}
        />
      ) : null}
    </>
  );
}
