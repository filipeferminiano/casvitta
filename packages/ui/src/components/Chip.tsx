import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

const chipVariants = cva(
  'inline-flex items-center gap-1 rounded-chip px-2 py-0.5 type-caption font-medium [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-subtle text-fg-strong',
        info: 'bg-action-subtle text-action-hover',
        success: 'bg-success-subtle text-success',
        attention: 'bg-attention-subtle text-attention-fg',
        danger: 'bg-danger-subtle text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type ChipProps = ComponentProps<'span'> &
  VariantProps<typeof chipVariants> & { icon?: ReactNode };

/** Small fact or tag, e.g. qualification chips on a lead ("FGTS", "Financiamento 80%"). */
export function Chip({ tone, icon, className, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone }), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
