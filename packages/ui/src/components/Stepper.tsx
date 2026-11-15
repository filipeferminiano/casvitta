import { Check } from 'lucide-react';
import { Fragment } from 'react';

import { cn } from '../lib/cn.ts';

export type StepperProps = {
  label: string;
  steps: { key: string; label: string }[];
  current: string;
  /** Screen-reader suffix for finished steps ("concluído"). */
  doneLabel: string;
  className?: string;
};

/** Numbered steps (Anúncios: Imóvel → Anúncio → Publicar); finished steps show a green check. */
export function Stepper({ label, steps, current, doneLabel, className }: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <ol aria-label={label} className={cn('flex flex-wrap items-center gap-3', className)}>
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <Fragment key={step.key}>
            {index > 0 ? (
              <li aria-hidden="true" className="hidden h-px w-8 bg-line sm:block" />
            ) : null}
            <li aria-current={active ? 'step' : undefined} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 items-center justify-center rounded-pill font-mono text-[12px] font-semibold',
                  done
                    ? 'bg-success text-white'
                    : active
                      ? 'bg-action text-white'
                      : 'bg-subtle text-fg-muted',
                )}
              >
                {done ? <Check strokeWidth={2.4} className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn('type-body-s', active ? 'font-semibold text-fg' : 'text-fg-strong')}
              >
                {step.label}
                {done ? <span className="sr-only">{` · ${doneLabel}`}</span> : null}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
