import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { Skeleton } from './Skeleton.tsx';

export type ValueConfidence = 'alta' | 'media' | 'baixa';

export type ValueRangeResultProps = {
  /** "Estimativa de valor de venda". */
  title: ReactNode;
  /** "Apartamento · 100 m² · Rua Joaquim Távora, 1240". */
  subject?: ReactNode;
  /** 'loading' shows a skeleton with `loadingLabel` (aria-live). */
  state: 'loading' | ValueConfidence;
  loadingLabel?: ReactNode;
  /** "R$ 690–810 mil", already formatted. */
  range?: ReactNode;
  /** "Valor central R$ 748 mil". */
  center?: ReactNode;
  /** "R$/m² de área construída (IPTU)" label with its Tooltip, from the caller. */
  priceM2Label?: ReactNode;
  priceM2?: ReactNode;
  /** Range bar labels: "menor" / "valor central" / "maior". */
  barLabels?: { low: ReactNode; center: ReactNode; high: ReactNode };
  /** "Confiança alta". */
  confidenceLabel?: ReactNode;
  /** "baseado em 38 vendas comparáveis no mesmo bairro". */
  basis?: ReactNode;
  /** Shown only for 'baixa': "Poucas vendas parecidas por perto. Use como referência inicial." */
  lowConfidenceNote?: ReactNode;
  /** ComparableGroupList. */
  groups?: ReactNode;
  /** "Estimativa estatística a partir de preços pagos. Não é laudo de avaliação." */
  disclaimer?: ReactNode;
  /** SourceNote. */
  source?: ReactNode;
  className?: string;
};

const confidenceChip: Record<ValueConfidence, string> = {
  alta: 'bg-success-subtle text-success',
  media: 'bg-action-subtle text-action-hover',
  baixa: 'bg-attention-subtle text-attention-fg',
};

/** Valuation result: the range is the hero number (mono); low confidence is marked in yellow. */
export function ValueRangeResult({
  title,
  subject,
  state,
  loadingLabel,
  range,
  center,
  priceM2Label,
  priceM2,
  barLabels,
  confidenceLabel,
  basis,
  lowConfidenceNote,
  groups,
  disclaimer,
  source,
  className,
}: ValueRangeResultProps) {
  const loading = state === 'loading';
  return (
    <section
      aria-live="polite"
      aria-busy={loading || undefined}
      className={cn(
        'flex flex-col gap-4 rounded-card border bg-panel p-5',
        state === 'baixa' ? 'border-attention' : 'border-line',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="type-eyebrow">{title}</h2>
        {subject ? <p className="type-body-s text-fg-strong">{subject}</p> : null}
      </div>
      {loading ? (
        <div className="flex flex-col gap-3" role="status">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          {loadingLabel ? <p className="type-body-s text-fg-muted">{loadingLabel}</p> : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[32px] leading-10 font-semibold tabular text-fg">
              {range}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 type-body-s text-fg-strong">
              {center}
              {priceM2 ? (
                <>
                  <span aria-hidden="true">·</span>
                  {priceM2Label}
                  <span className="font-mono tabular">{priceM2}</span>
                </>
              ) : null}
            </p>
          </div>
          {barLabels ? (
            <div aria-hidden="true" className="flex flex-col gap-1">
              <div className="relative h-2 rounded-pill bg-subtle">
                <div className="absolute inset-y-0 left-[12%] right-[12%] rounded-pill bg-action" />
                <div className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-panel bg-fg" />
              </div>
              <div className="flex justify-between type-caption">
                <span>{barLabels.low}</span>
                <span>{barLabels.center}</span>
                <span>{barLabels.high}</span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 type-body-s">
            <span
              className={cn(
                'rounded-chip px-2 py-0.5 type-caption font-semibold',
                confidenceChip[state],
              )}
            >
              {confidenceLabel}
            </span>
            {basis ? <span className="text-fg-muted">{basis}</span> : null}
          </div>
          {state === 'baixa' && lowConfidenceNote ? (
            <p className="flex gap-2 rounded-control border border-attention-line bg-attention-subtle p-3 type-body-s text-fg-strong">
              <TriangleAlert
                aria-hidden="true"
                strokeWidth={1.6}
                className="size-5 shrink-0 text-attention-fg"
              />
              {lowConfidenceNote}
            </p>
          ) : null}
          {groups}
        </>
      )}
      {disclaimer ? <p className="type-caption">{disclaimer}</p> : null}
      {source}
    </section>
  );
}
