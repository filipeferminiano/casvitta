import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type BreakdownRow = {
  key: string;
  /** "Financiada pelo SFH" (may include a "texto a revisar" marker). */
  label: ReactNode;
  /** "R$ 600.000 × 0,5%". */
  formula: ReactNode;
  /** "R$ 3.000,00". */
  amount: ReactNode;
};

export type BreakdownTableProps = {
  /** Accessible caption, e.g. "Cálculo do ITBI". */
  caption: string;
  rows: BreakdownRow[];
  totalLabel: ReactNode;
  total: ReactNode;
  className?: string;
};

/** Base × rate = tax per part, with a highlighted total (values in mono, right-aligned). */
export function BreakdownTable({
  caption,
  rows,
  totalLabel,
  total,
  className,
}: BreakdownTableProps) {
  return (
    <table className={cn('w-full border-collapse type-body-s', className)}>
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line">
            <th scope="row" className="py-2 pr-3 text-left align-top font-normal text-fg">
              <span className="block">{row.label}</span>
              <span className="block font-mono type-caption tabular">{row.formula}</span>
            </th>
            <td className="py-2 text-right align-top font-mono tabular text-fg">{row.amount}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-fg">
          <th scope="row" className="py-2 text-left font-semibold text-fg">
            {totalLabel}
          </th>
          <td className="py-2 text-right font-mono font-semibold tabular text-fg">{total}</td>
        </tr>
      </tfoot>
    </table>
  );
}
