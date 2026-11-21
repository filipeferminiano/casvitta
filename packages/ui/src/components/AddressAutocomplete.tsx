'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { controlClasses, Field } from './Field.tsx';

export type AddressSuggestion = {
  /** Stable key, e.g. "rua-joaquim-tavora|1240". */
  id: string;
  /** "Rua Joaquim Távora, 1240". */
  label: string;
  /** "Vila Mariana · São Paulo". */
  detail?: string;
};

export type AddressAutocompleteStatus =
  'idle' | 'loading' | 'suggestions' | 'not_found' | 'outside_coverage';

export type AddressAutocompleteLabels = {
  label: string;
  placeholder?: string;
  help?: string;
  /** "Endereços de São Paulo · cobertura: capital". */
  coverage: string;
  /** "Procurando endereços…". */
  loading: string;
  /** "Não achamos esse endereço". */
  notFound: string;
  /** "Ainda não cobrimos este endereço". */
  outsideCoverage: string;
};

export type AddressAutocompleteProps = {
  value: string;
  suggestions: AddressSuggestion[];
  status: AddressAutocompleteStatus;
  onQueryChange: (query: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  labels: AddressAutocompleteLabels;
  error?: ReactNode;
  name?: string;
  id?: string;
  className?: string;
};

const MAX_SUGGESTIONS = 3;

/**
 * Street + number field with at most 3 suggestions (WAI-ARIA combobox: arrows move, Enter
 * selects, Escape closes). Controlled: the page fetches suggestions and passes `status`.
 */
export function AddressAutocomplete({
  value,
  suggestions,
  status,
  onQueryChange,
  onSelect,
  labels,
  error,
  name = 'address',
  id,
  className,
}: AddressAutocompleteProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = suggestions.slice(0, MAX_SUGGESTIONS);
  const expanded = open && status === 'suggestions' && options.length > 0;

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onSelect(option);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const message =
    status === 'loading'
      ? labels.loading
      : status === 'not_found'
        ? labels.notFound
        : status === 'outside_coverage'
          ? labels.outsideCoverage
          : null;

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
      <Field label={labels.label} help={labels.help} error={error} id={inputId}>
        {(field) => (
          <input
            {...field}
            type="text"
            name={name}
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            placeholder={labels.placeholder}
            value={value}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            className={controlClasses}
          />
        )}
      </Field>
      <ul
        id={listId}
        role="listbox"
        aria-label={labels.label}
        hidden={!expanded}
        className="flex flex-col overflow-hidden rounded-control border border-line bg-panel"
      >
        {options.map((option, index) => (
          <li
            key={option.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // mousedown so the input's blur does not close the list first
            onMouseDown={(e) => {
              e.preventDefault();
              choose(index);
            }}
            className={cn(
              'flex min-h-11 cursor-pointer flex-col justify-center border-b border-line px-3 py-2 last:border-b-0',
              index === active ? 'bg-action-subtle' : 'hover:bg-subtle',
            )}
          >
            <span className="type-body-s text-fg">{option.label}</span>
            {option.detail ? <span className="type-caption">{option.detail}</span> : null}
          </li>
        ))}
      </ul>
      <p id={statusId} className="type-caption" aria-live="polite">
        {message ?? labels.coverage}
      </p>
    </div>
  );
}
