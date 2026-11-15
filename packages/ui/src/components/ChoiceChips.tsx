'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ChoiceChipsProps = {
  /** Visible group label (legend). */
  label: ReactNode;
  name: string;
  options: { value: string; label: ReactNode }[];
  /** Multiple = checkboxes; single = radios. */
  multiple?: boolean;
  value: string[];
  onChange: (value: string[]) => void;
  error?: ReactNode;
  className?: string;
};

/** Toggle chips backed by real radios/checkboxes in a fieldset (auction 59, owner 56). */
export function ChoiceChips({
  label,
  name,
  options,
  multiple = false,
  value,
  onChange,
  error,
  className,
}: ChoiceChipsProps) {
  const errorId = useId();
  return (
    <fieldset
      className={cn('flex flex-col gap-2', className)}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-2 type-body-s font-medium text-fg">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center rounded-control border px-4 type-body-s select-none',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                checked
                  ? 'border-2 border-action bg-action-subtle font-semibold'
                  : 'border-line bg-panel hover:bg-canvas',
              )}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={option.value}
                checked={checked}
                className="sr-only"
                onChange={() =>
                  onChange(
                    multiple
                      ? checked
                        ? value.filter((v) => v !== option.value)
                        : [...value, option.value]
                      : [option.value],
                  )
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
