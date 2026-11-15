'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { controlClasses, Field } from './Field.tsx';

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

export type SelectProps = {
  label: ReactNode;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  id?: string;
  className?: string;
};

export function Select({
  label,
  options,
  placeholder,
  help,
  error,
  hint,
  id,
  className,
  ...rootProps
}: SelectProps) {
  return (
    <Field label={label} help={help} error={error} hint={hint} id={id} className={className}>
      {(field) => (
        <RadixSelect.Root {...rootProps}>
          <RadixSelect.Trigger
            {...field}
            className={cn(
              controlClasses,
              'flex items-center justify-between gap-2 text-left data-placeholder:text-fg-muted',
            )}
          >
            <RadixSelect.Value placeholder={placeholder} />
            <RadixSelect.Icon>
              <ChevronDown aria-hidden="true" strokeWidth={1.6} className="size-5 text-fg-muted" />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content
              position="popper"
              sideOffset={4}
              className="z-50 max-h-80 min-w-(--radix-select-trigger-width) overflow-hidden rounded-card border border-line bg-panel shadow-menu"
            >
              <RadixSelect.Viewport className="p-1">
                {options.map((option) => (
                  <RadixSelect.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      'relative flex min-h-11 cursor-pointer items-center rounded-control py-2 pr-3 pl-9 type-body-s text-fg outline-none select-none',
                      'data-highlighted:bg-action-subtle data-disabled:cursor-not-allowed data-disabled:text-disabled-text',
                    )}
                  >
                    <RadixSelect.ItemIndicator className="absolute left-2.5 inline-flex">
                      <Check aria-hidden="true" strokeWidth={1.6} className="size-4 text-action" />
                    </RadixSelect.ItemIndicator>
                    <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      )}
    </Field>
  );
}
