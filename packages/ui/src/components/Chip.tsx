import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
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
  VariantProps<typeof chipVariants> & {
    icon?: ReactNode;
    /** Shows a remove button (needs `removeLabel`, e.g. "Remover Vila Mariana"). */
    onRemove?: () => void;
    removeLabel?: string;
  };

/** Small fact or tag, e.g. qualification chips on a lead ("FGTS", "Financiamento 80%"). */
export function Chip({
  tone,
  icon,
  onRemove,
  removeLabel,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone }), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
      ) : null}
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="hit-area-44 -mr-0.5 rounded-pill p-0.5 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * Pill style for search filter chips rendered as links (removing a filter changes the URL).
 * `active` = the filter is applied (blue outline).
 */
export function filterChipClass(active: boolean): string {
  return cn(
    'inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-3.5 type-body-s whitespace-nowrap hit-area-44',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    active
      ? 'border-action bg-action-subtle text-fg hover:bg-blue-200/40'
      : 'border-line bg-panel text-fg hover:bg-subtle',
  );
}
