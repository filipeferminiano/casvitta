'use client';

import { ToggleGroup } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type SegmentedOption = { value: string; label: ReactNode; disabled?: boolean };

export type SegmentedControlProps = {
  /** Accessible name for the group. */
  label: string;
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'md' | 'sm';
  className?: string;
};

/** One choice among a few, always one selected. Keyboard: arrows move, space/enter select. */
export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
  size = 'md',
  className,
}: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next); // never allow "none selected"
      }}
      className={cn('inline-flex rounded-control bg-subtle p-1', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            'rounded-chip px-3 type-body-s font-medium text-fg-muted transition-colors',
            size === 'md' ? 'min-h-9 py-1 leading-4' : 'hit-area-44 h-7',
            'hover:text-fg',
            'data-[state=on]:bg-panel data-[state=on]:text-fg data-[state=on]:shadow-[0_0_0_1px_var(--color-line)]',
            'disabled:cursor-not-allowed disabled:text-disabled-text',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
