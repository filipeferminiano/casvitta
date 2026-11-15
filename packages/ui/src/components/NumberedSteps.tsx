import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type NumberedStepsProps = {
  steps: { key: string; title: ReactNode; description?: ReactNode }[];
  /** "cards" = boxed columns (home 51); "list" = stacked rows (owner 56, auction 59). */
  variant?: 'cards' | 'list';
  className?: string;
};

/** "Como funciona" / "O que acontece depois": numbered steps in a real ordered list. */
export function NumberedSteps({ steps, variant = 'cards', className }: NumberedStepsProps) {
  if (variant === 'list') {
    return (
      <ol className={cn('flex flex-col gap-4', className)}>
        {steps.map((step, i) => (
          <li key={step.key} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-action-subtle font-mono type-body-s font-semibold text-action"
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-0.5 pt-1">
              <p className="type-body font-semibold">{step.title}</p>
              {step.description ? (
                <p className="type-body-s text-fg-strong">{step.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol
      className={cn(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]',
        className,
      )}
    >
      {steps.map((step, i) => (
        <li
          key={step.key}
          className="flex flex-col gap-2 rounded-card border border-line bg-panel p-5"
        >
          <span aria-hidden="true" className="font-display text-[24px] font-medium text-action">
            {i + 1}
          </span>
          <p className="type-title text-[19px] leading-6">{step.title}</p>
          {step.description ? (
            <p className="type-body-s text-fg-strong">{step.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
