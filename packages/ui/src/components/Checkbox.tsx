'use client';

import { Check, Minus } from 'lucide-react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type CheckboxProps = Omit<ComponentProps<typeof RadixCheckbox.Root>, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
};

export function Checkbox({ label, description, error, id, className, ...props }: CheckboxProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex min-h-11 items-start gap-3 py-2.5">
        <RadixCheckbox.Root
          id={controlId}
          aria-describedby={[errorId, descriptionId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'hit-area-44 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-chip border border-ink-500 bg-panel',
            'data-[state=checked]:border-action data-[state=checked]:bg-action data-[state=checked]:text-fg-on-action',
            'data-[state=indeterminate]:border-action data-[state=indeterminate]:bg-action data-[state=indeterminate]:text-fg-on-action',
            'aria-invalid:border-danger',
            'disabled:cursor-not-allowed disabled:border-disabled-text disabled:bg-disabled-bg',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
          {...props}
        >
          <RadixCheckbox.Indicator className="group">
            <Check
              aria-hidden="true"
              strokeWidth={2.4}
              className="size-4 group-data-[state=indeterminate]:hidden"
            />
            <Minus
              aria-hidden="true"
              strokeWidth={2.4}
              className="hidden size-4 group-data-[state=indeterminate]:block"
            />
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        <div className="flex flex-col gap-0.5">
          <label htmlFor={controlId} className="cursor-pointer type-body-s font-medium text-fg">
            {label}
          </label>
          {description ? (
            <p id={descriptionId} className="type-caption">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
