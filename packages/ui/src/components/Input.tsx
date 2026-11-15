import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { controlClasses, Field } from './Field.tsx';

export type InputProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  id?: string;
  /** Classes for the wrapper (label + input + messages). */
  className?: string;
  inputClassName?: string;
};

export function Input({
  label,
  help,
  error,
  hint,
  id,
  className,
  inputClassName,
  ...props
}: InputProps) {
  return (
    <Field label={label} help={help} error={error} hint={hint} id={id} className={className}>
      {(field) => <input {...field} {...props} className={cn(controlClasses, inputClassName)} />}
    </Field>
  );
}
