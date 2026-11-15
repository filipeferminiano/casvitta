import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn.ts';

const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 type-caption font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'border-success/30 bg-success-subtle text-success', // No ar, Confirmada, Pago
        neutral: 'border-line bg-subtle text-fg-strong', // Rascunho
        attention: 'border-attention-line bg-attention-subtle text-attention-fg', // Pausado, Aguardando
        danger: 'border-danger/30 bg-danger-subtle text-danger', // Sem autorização, Recusado
        info: 'border-action-line bg-action-subtle text-action-hover', // Em análise
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const dotColor = {
  success: 'bg-success',
  neutral: 'bg-ink-500',
  attention: 'bg-attention',
  danger: 'bg-danger',
  info: 'bg-action',
} as const;

export type StatusPillProps = ComponentProps<'span'> & VariantProps<typeof pillVariants>;

/** Status of a record. The text must carry the meaning on its own; color only reinforces it. */
export function StatusPill({ tone, className, children, ...props }: StatusPillProps) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...props}>
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-pill', dotColor[tone ?? 'neutral'])}
      />
      {children}
    </span>
  );
}
