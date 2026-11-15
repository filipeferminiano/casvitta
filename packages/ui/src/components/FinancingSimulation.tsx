import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type FinancingSimulationProps = {
  title: ReactNode;
  /** The mandatory "Simulação · não é aprovação" badge. */
  badge: ReactNode;
  /** Optional context line ("Sobre a proposta de R$ 672 mil"). */
  context?: ReactNode;
  /** Inputs (entrada, FGTS, prazo) for interactive simulations. */
  inputs?: ReactNode;
  resultLabel?: ReactNode;
  /** First installment, formatted. */
  result: ReactNode;
  /** Rate, term, income share and "sem seguros e tarifas". */
  details: ReactNode;
  /** Optional key/value rows (financed amount, % of income, rate). */
  rows?: { key: string; label: ReactNode; value: ReactNode }[];
  className?: string;
};

/**
 * Financing simulation. Every number here is a simulation: the badge is required and the caller
 * must state the illustrative rate and that insurance and fees are not included.
 */
export function FinancingSimulation({
  title,
  badge,
  context,
  inputs,
  resultLabel,
  result,
  details,
  rows,
  className,
}: FinancingSimulationProps) {
  return (
    <section
      className={cn('flex flex-col gap-3 rounded-card border border-line bg-panel p-5', className)}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="type-title text-[20px] leading-7">{title}</h2>
        {badge}
      </header>
      {context ? <p className="type-body-s text-fg-strong">{context}</p> : null}
      {inputs ? <div className="grid gap-3">{inputs}</div> : null}
      {rows ? (
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.key} className="flex justify-between gap-4 py-2">
              <dt className="type-body-s text-fg-strong">{row.label}</dt>
              <dd className="font-mono type-body-s font-semibold tabular">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex flex-col">
        {resultLabel ? <span className="type-caption">{resultLabel}</span> : null}
        <span className="type-value">{result}</span>
      </div>
      <p className="type-caption">{details}</p>
    </section>
  );
}
