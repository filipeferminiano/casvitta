import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type KeyValueRow = { key: string; label: ReactNode; value: ReactNode };

/** Label/value rows separated by rules; values bold, right-aligned. */
export function KeyValueList({ rows, className }: { rows: KeyValueRow[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line', className)}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="type-body-s text-fg-strong">{row.label}</dt>
          <dd className="text-right type-body-s font-semibold text-fg">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type QualificationPanelProps = {
  title: ReactNode;
  /** Status pill, e.g. "Qualificado". */
  status?: ReactNode;
  rows: KeyValueRow[];
  /** "Respostas do lead, não verificadas." — always shown. */
  footnote: ReactNode;
  className?: string;
};

/** Answers the lead gave the AI (financing, FGTS, down payment, income, timeframe). */
export function QualificationPanel({
  title,
  status,
  rows,
  footnote,
  className,
}: QualificationPanelProps) {
  return (
    <section className={cn('rounded-card border border-line bg-panel p-5', className)}>
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="type-title text-[20px] leading-7">{title}</h2>
        {status}
      </header>
      <KeyValueList rows={rows} />
      <p className="mt-3 type-caption">{footnote}</p>
    </section>
  );
}
