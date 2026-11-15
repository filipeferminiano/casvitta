import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type FieldRenderProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
};

export type FieldProps = {
  label: ReactNode;
  /** Help text under the field. */
  help?: ReactNode;
  /** Error text: say what is wrong and how to fix it. */
  error?: ReactNode;
  /** Shown after the label, e.g. "(opcional)". */
  hint?: ReactNode;
  id?: string;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
};

/** Label always visible, help and error text wired to the control via aria-describedby. */
export function Field({ label, help, error, hint, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="type-body-s font-medium text-fg">
        {label}
        {hint ? <span className="ml-1 font-normal text-fg-muted">{hint}</span> : null}
      </label>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
      {help ? (
        <p id={helpId} className="type-caption">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses = [
  'h-11 w-full rounded-control border border-line bg-panel px-3 type-body text-fg',
  'placeholder:text-fg-muted',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:border-focus',
  'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger',
  'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text',
].join(' ');
