'use client';

import { Switch as RadixSwitch } from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type SwitchProps = Omit<ComponentProps<typeof RadixSwitch.Root>, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  /** Extra info aligned right, e.g. a cost note ("incluso"). */
  aside?: ReactNode;
};

export function Switch({ label, description, aside, id, className, ...props }: SwitchProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-2', className)}>
      <RadixSwitch.Root
        id={controlId}
        aria-describedby={descriptionId}
        className={cn(
          'hit-area-44 relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-pill bg-ink-300 transition-colors',
          'data-[state=checked]:bg-action',
          'disabled:cursor-not-allowed disabled:bg-disabled-bg',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
        {...props}
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-pill bg-panel transition-transform data-[state=checked]:translate-x-[18px]" />
      </RadixSwitch.Root>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={controlId} className="cursor-pointer type-body-s font-medium text-fg">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="type-caption">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0 type-caption">{aside}</div> : null}
    </div>
  );
}
