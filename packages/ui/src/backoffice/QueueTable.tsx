'use client';

import { useRef, type ComponentProps, type KeyboardEvent, type Key, type ReactNode } from 'react';

import { controlClasses, Field } from '../components/Field.tsx';
import { cn } from '../lib/cn.ts';

export type QueueColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  className?: string;
};

export type QueueTableProps<Row> = {
  caption: string;
  /** First column: what the row is (name). Rendered as the row's select button. */
  primary: QueueColumn<Row>;
  columns: QueueColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectedKey: string | null;
  onSelect: (row: Row) => void;
  /** Accessible name of each select button, e.g. "Ver Ana Ribeiro". */
  selectLabel: (row: Row) => string;
  empty?: ReactNode;
};

/**
 * Work queue (BO2, BO3, BO6): one row is open in the detail panel at a time. Each row's name is a
 * real button (Enter/Space opens it); ArrowUp/ArrowDown move to the previous or next row and
 * open it, so a queue can be worked through from the keyboard.
 */
export function QueueTable<Row>({
  caption,
  primary,
  columns,
  rows,
  rowKey,
  selectedKey,
  onSelect,
  selectLabel,
  empty,
}: QueueTableProps<Row>) {
  const buttons = useRef(new Map<Key, HTMLButtonElement>());
  if (rows.length === 0 && empty) return <>{empty}</>;

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = rows[index + step];
    if (!next) return;
    onSelect(next);
    buttons.current.get(rowKey(next))?.focus();
  };

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-panel">
      <table className="w-full border-collapse type-body-s">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-canvas">
          <tr>
            {[primary, ...columns].map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'border-b border-line px-3 py-2.5 type-caption font-medium whitespace-nowrap text-fg',
                  c.numeric ? 'text-right' : 'text-left',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                className={cn(
                  'border-b border-line last:border-b-0',
                  selected ? 'bg-action-subtle' : 'hover:bg-canvas',
                )}
              >
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) buttons.current.set(key, el);
                      else buttons.current.delete(key);
                    }}
                    aria-label={selectLabel(row)}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(row)}
                    onKeyDown={(e) => move(e, index)}
                    className="-mx-1 flex min-h-11 w-full flex-col items-start justify-center rounded-control px-1 text-left focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {primary.cell(row)}
                  </button>
                </th>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 py-2 text-fg',
                      c.numeric && 'text-right font-mono tabular',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type TextareaProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  id?: string;
};

/** Multi-line field with a visible label (reasons, notes). */
export function Textarea({ label, help, error, id, className, ...props }: TextareaProps) {
  return (
    <Field label={label} help={help} error={error} id={id}>
      {(field) => (
        <textarea
          {...field}
          {...props}
          className={cn(controlClasses, 'h-auto min-h-24 py-2', className)}
        />
      )}
    </Field>
  );
}
