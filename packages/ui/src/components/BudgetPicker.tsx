'use client';

import { Sparkles } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { CurrencyInput } from './CurrencyInput.tsx';

export type BudgetPickerProps = {
  label: string;
  /** Integer cents per day. */
  value: number;
  onChange: (cents: number) => void;
  /** Suggested amounts in cents (e.g. 2000, 3000, 5000). */
  suggestions: number[];
  recommended: number;
  minimum: number;
  format: (cents: number) => string;
  copy: {
    perDay: string;
    recommended: string;
    other: string; // "Outro valor"
    otherHelp: string; // "Mínimo de R$ 20 por dia."
    belowMinimum: string; // error text
  };
  /** Explanation box: why the recommendation, as a range, "não é uma promessa". */
  explanation: ReactNode;
  /** Duration / region / max spend summary row. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Daily budget (DESIGN_SYSTEM §6): suggestions with one "recomendado", a free amount at or above
 * the minimum, the recommendation as a range (never a promise), and duration/region/max spend.
 */
export function BudgetPicker({
  label,
  value,
  onChange,
  suggestions,
  recommended,
  minimum,
  format,
  copy,
  explanation,
  footer,
  className,
}: BudgetPickerProps) {
  const name = useId();
  const isSuggestion = suggestions.includes(value);
  return (
    <fieldset className={cn('flex flex-col gap-4', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="grid grid-cols-3 gap-3">
        {suggestions.map((cents) => {
          const checked = value === cents;
          return (
            <label
              key={cents}
              className={cn(
                'flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-control px-2 py-2 text-center has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                checked
                  ? 'border-2 border-action bg-action-subtle'
                  : 'border border-line bg-panel hover:bg-canvas',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(cents)}
              />
              <span className="font-mono text-[18px] leading-6 font-semibold tabular">
                {format(cents)}
              </span>
              <span className="type-caption">
                {cents === recommended ? copy.recommended : copy.perDay}
              </span>
            </label>
          );
        })}
      </div>
      <CurrencyInput
        label={copy.other}
        value={isSuggestion ? null : value}
        onValueChange={(cents) => onChange(cents ?? recommended)}
        help={copy.otherHelp}
        error={value < minimum ? copy.belowMinimum : undefined}
        className="max-w-60"
      />
      <div className="flex gap-3 rounded-control bg-canvas p-3 type-body-s text-fg-strong">
        <Sparkles
          aria-hidden="true"
          strokeWidth={1.6}
          className="mt-0.5 size-4 shrink-0 text-action"
        />
        <div>{explanation}</div>
      </div>
      {footer}
    </fieldset>
  );
}

export type ChannelToggleProps = {
  name: ReactNode;
  description: ReactNode;
  /** "incluso" / "do orçamento". */
  costNote: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** Channel switch row: name + description + cost note (DESIGN_SYSTEM §6 ChannelToggle). */
export function ChannelToggle({
  name,
  description,
  costNote,
  checked,
  onCheckedChange,
  disabled,
}: ChannelToggleProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 rounded-control border border-line px-4 py-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-description`}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'hit-area-44 relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors',
          checked ? 'bg-action' : 'bg-ink-300',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <span
          className={cn(
            'block size-5 rounded-pill bg-panel transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
        <span className="type-body-s font-semibold">{name}</span>
        <span id={`${id}-description`} className="type-caption text-fg-strong">
          {description}
        </span>
      </label>
      <span className="shrink-0 font-mono type-caption text-fg-strong">{costNote}</span>
    </div>
  );
}
