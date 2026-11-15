import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type EstimateBoxProps = {
  rows: { key: string; label: ReactNode; value: ReactNode }[];
  /** "Estimativa · não é garantia" (mandatory, CLAUDE.md rule 12). */
  badge: ReactNode;
  /** "Base: 9 aluguéis parecidos no bairro". */
  basis: ReactNode;
  className?: string;
};

/**
 * Rental income / yield estimate. Callers must not render it below 5 comparables (rule 12).
 */
export function EstimateBox({ rows, badge, basis, className }: EstimateBoxProps) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-control bg-canvas p-3', className)}>
      <dl className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row.key}>
            <dt className="type-caption">{row.label}</dt>
            <dd className="font-mono type-body font-semibold tabular">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        <span className="type-caption">{basis}</span>
      </div>
    </div>
  );
}
