import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { Skeleton } from './Skeleton.tsx';

/*
 * Every list and screen implements all three states (DESIGN_SYSTEM.md §6):
 * EmptyState, LoadingState and ErrorState.
 */

export type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  /** Why it is empty and what will make it fill up. */
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-line-dashed bg-panel px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-pill bg-subtle text-fg-muted [&_svg]:size-6"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="type-title text-fg">{title}</h2>
      {description ? <p className="max-w-[52ch] type-body text-fg-muted">{description}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </section>
  );
}

export type LoadingStateProps = {
  /** What is happening, e.g. "Carregando seus leads". */
  title: ReactNode;
  /** How long it usually takes, e.g. "Leva alguns segundos." */
  description?: ReactNode;
  /** Number of skeleton rows. */
  rows?: number;
  className?: string;
};

export function LoadingState({ title, description, rows = 3, className }: LoadingStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn('flex flex-col gap-4 rounded-card border border-line bg-panel p-6', className)}
    >
      <div className="flex flex-col gap-1">
        <p className="type-body font-medium text-fg">{title}</p>
        {description ? <p className="type-body-s text-fg-muted">{description}</p> : null}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-control" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export type ErrorStateProps = {
  /** What failed. */
  title: ReactNode;
  /** What still works, e.g. "O marketplace e o Google seguem no ar." */
  stillWorks?: ReactNode;
  /** How to fix it. */
  howToFix?: ReactNode;
  /** Up to two actions: the fix first, then an alternative. */
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
};

export function ErrorState({
  title,
  stillWorks,
  howToFix,
  primaryAction,
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className={cn(
        'flex gap-3 rounded-card border border-danger/30 bg-danger-subtle p-4 sm:p-5',
        className,
      )}
    >
      <CircleAlert
        aria-hidden="true"
        strokeWidth={1.6}
        className="mt-0.5 size-5 shrink-0 text-danger"
      />
      <div className="flex flex-col gap-1.5">
        <h2 className="type-body font-semibold text-fg">{title}</h2>
        {stillWorks ? <p className="type-body-s text-fg-strong">{stillWorks}</p> : null}
        {howToFix ? <p className="type-body-s text-fg-strong">{howToFix}</p> : null}
        {primaryAction || secondaryAction ? (
          <div className="mt-2 flex flex-wrap gap-3">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </section>
  );
}
