'use client';

import { Info } from 'lucide-react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type TooltipProviderProps = { children: ReactNode; delayDuration?: number };

/** Wrap the page (or app) once; tooltips share one open delay. */
export function TooltipProvider({ children, delayDuration = 200 }: TooltipProviderProps) {
  return <RadixTooltip.Provider delayDuration={delayDuration}>{children}</RadixTooltip.Provider>;
}

export type TooltipProps = {
  /** Accessible name of the info button, e.g. "O que é área construída (IPTU)?". */
  label: string;
  /** Explanation shown on hover and on keyboard focus. */
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
};

/** Info button with a short explanation. Works with mouse, touch (tap) and keyboard focus. */
export function Tooltip({ label, content, side = 'top', className }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'hit-area-44 inline-flex size-6 shrink-0 items-center justify-center rounded-pill text-fg-muted',
            'hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            className,
          )}
        >
          <Info aria-hidden="true" strokeWidth={1.6} className="size-4" />
        </button>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-w-72 rounded-control bg-ink-900 px-3 py-2 type-body-s text-white shadow-md"
        >
          {content}
          <RadixTooltip.Arrow className="fill-ink-900" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
