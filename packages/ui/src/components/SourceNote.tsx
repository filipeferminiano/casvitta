import { Fragment, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type SourceNoteProps = {
  /** E.g. "Fonte: Prefeitura de São Paulo — guias de ITBI". */
  source: ReactNode;
  /** E.g. "Atualizado em 05/11/2026". */
  updated?: ReactNode;
  /** Extra facts joined by " · ", e.g. the window "set/2025 a ago/2026". */
  items?: ReactNode[];
  className?: string;
};

/** One caption line with the data source and freshness. Every data page shows it. */
export function SourceNote({ source, updated, items = [], className }: SourceNoteProps) {
  const parts = [source, updated, ...items].filter((part) => part !== undefined && part !== null);
  return (
    <p className={cn('type-caption', className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}
