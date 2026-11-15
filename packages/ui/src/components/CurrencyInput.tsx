'use client';

import type { ChangeEvent, ComponentProps, KeyboardEvent, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { formatCentsInput } from '../lib/format.ts';
import { controlClasses, Field } from './Field.tsx';

const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

export type CurrencyInputProps = Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'id'
> & {
  label: ReactNode;
  /** Integer cents, or null when empty. */
  value: number | null;
  onValueChange: (cents: number | null) => void;
  help?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  id?: string;
  className?: string;
};

/** Keeps only digits, read as cents: "656340" -> 656340. */
export function parseCentsInput(text: string): number | null {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return null;
  return Math.min(Number(digits), MAX_CENTS);
}

/**
 * Money input in BRL. Shows "R$" as a prefix and works in integer cents: typing digits fills
 * from the right, like a cash register ("6", "65", … -> "6.563,40").
 */
export function CurrencyInput({
  label,
  value,
  onValueChange,
  help,
  error,
  hint,
  id,
  className,
  placeholder = '0,00',
  ...props
}: CurrencyInputProps) {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(parseCentsInput(event.target.value));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === 'Backspace' &&
      value !== null &&
      event.currentTarget.selectionStart === event.currentTarget.value.length
    ) {
      event.preventDefault();
      const next = Math.floor(value / 10);
      onValueChange(next === 0 ? null : next);
    }
  };

  return (
    <Field label={label} help={help} error={error} hint={hint} id={id} className={className}>
      {(field) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono tabular text-fg-muted"
          >
            R$
          </span>
          <input
            {...field}
            {...props}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={value === null ? '' : formatCentsInput(value)}
            onChange={onChange}
            onKeyDown={onKeyDown}
            className={cn(controlClasses, 'pl-11 text-right font-mono tabular')}
          />
        </div>
      )}
    </Field>
  );
}
