import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type TaxCalculatorCardProps = {
  /** "Calculadora de ITBI · São Paulo". */
  title: ReactNode;
  /** "alíquota 3%" chip. */
  rateChip?: ReactNode;
  /** "texto a revisar" marker while the legal rules are unreviewed. */
  reviewMarker?: ReactNode;
  /** The form fields (CurrencyInput, SegmentedControl…) and the submit button. */
  children: ReactNode;
  /** 'empty' draws the result with a dashed outline and `emptyHint`. */
  state: 'empty' | 'result';
  /** "ITBI estimado". */
  resultLabel: ReactNode;
  /** "R$ 7.500,00" (ignored while empty). */
  total?: ReactNode;
  /** "Preencha o preço de compra para calcular." */
  emptyHint?: ReactNode;
  /** Placeholder total while empty. */
  emptyValue?: ReactNode;
  /** "Base de cálculo usada: R$ 750.000 · o maior entre preço e valor venal". */
  base?: ReactNode;
  /** BreakdownTable. */
  breakdown?: ReactNode;
  /** "Valor estimado. Confirme na guia oficial da Prefeitura." */
  disclaimer?: ReactNode;
  /** Extra estimates, e.g. registration costs as a labeled range. */
  extra?: ReactNode;
  /** Id of the result region, for a sticky bar's "Ver detalhes" link. */
  resultId?: string;
  className?: string;
};

/** ITBI calculator: inputs and result in one card. Rules and copy come from the caller. */
export function TaxCalculatorCard({
  title,
  rateChip,
  reviewMarker,
  children,
  state,
  resultLabel,
  total,
  emptyHint,
  emptyValue = 'R$ —',
  base,
  breakdown,
  disclaimer,
  extra,
  resultId,
  className,
}: TaxCalculatorCardProps) {
  const empty = state === 'empty';
  return (
    <section
      className={cn('flex flex-col gap-5 rounded-card border border-line bg-panel p-5', className)}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="type-body font-semibold text-fg">{title}</h2>
        {rateChip ? (
          <span className="rounded-chip bg-subtle px-2 py-0.5 type-caption font-medium text-fg-strong">
            {rateChip}
          </span>
        ) : null}
        {reviewMarker}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
      <div
        id={resultId}
        aria-live="polite"
        className={cn(
          'flex flex-col gap-3 rounded-control p-4',
          empty ? 'border border-dashed border-line-dashed' : 'border border-line bg-canvas',
        )}
      >
        <p className="type-eyebrow">{resultLabel}</p>
        {empty ? (
          <>
            <p className="font-mono text-[28px] leading-9 font-semibold tabular text-fg-muted">
              {emptyValue}
            </p>
            {emptyHint ? <p className="type-body-s text-fg-muted">{emptyHint}</p> : null}
          </>
        ) : (
          <>
            <p className="font-mono text-[28px] leading-9 font-semibold tabular text-fg">{total}</p>
            {base ? <p className="type-body-s text-fg-strong">{base}</p> : null}
            {breakdown}
            {disclaimer ? <p className="type-caption">{disclaimer}</p> : null}
          </>
        )}
      </div>
      {!empty && extra ? <div className="type-body-s text-fg-strong">{extra}</div> : null}
    </section>
  );
}
