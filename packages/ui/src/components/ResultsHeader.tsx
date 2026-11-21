import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ResultsView = { key: 'list' | 'map'; label: string; href: string; current: boolean };

export type ResultsHeaderProps = {
  /** "7 anúncios · só anúncios autorizados, com CRECI" (real count from the caller). */
  count: ReactNode;
  /** Sort control (a Select, or a link list for no-JS), rendered as given. */
  sort?: ReactNode;
  /** Lista / Mapa as links, so the view works without JS. */
  views?: ResultsView[];
  /** Accessible name of the view switch, e.g. "Visualização". */
  viewsLabel?: string;
  loading?: boolean;
  className?: string;
};

/** Real result count, the "only authorized listings" note, sorting and Lista/Mapa. */
export function ResultsHeader({
  count,
  sort,
  views,
  viewsLabel,
  loading,
  className,
}: ResultsHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3',
        className,
      )}
    >
      <p className="type-body-s text-fg-strong" aria-live="polite" aria-busy={loading || undefined}>
        {count}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {sort}
        {views?.length ? (
          <nav
            aria-label={viewsLabel}
            className="flex overflow-hidden rounded-control border border-line"
          >
            {views.map((view) => (
              <a
                key={view.key}
                href={view.href}
                aria-current={view.current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center px-4 type-body-s font-medium focus-visible:outline-2 focus-visible:outline-focus',
                  view.current ? 'bg-fg text-white' : 'bg-panel text-fg hover:bg-subtle',
                )}
              >
                {view.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
