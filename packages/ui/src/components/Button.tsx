import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { Spinner } from './Spinner.tsx';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-control font-body font-medium whitespace-nowrap',
    'transition-colors select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-text',
    'aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-disabled-bg aria-disabled:text-disabled-text',
    '[&_svg]:size-5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-action text-fg-on-action hover:bg-action-hover',
        secondary: 'border border-fg bg-panel text-fg hover:bg-subtle',
        ghost: 'text-fg hover:bg-subtle',
        danger: 'bg-danger text-white hover:brightness-90',
      },
      size: {
        md: 'h-11 px-5 text-body-s',
        // 36px visual height for dense desktop screens; hit area still 44px.
        sm: 'hit-area-44 h-9 px-3 text-body-s',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a link) with button styles. */
    asChild?: boolean;
    /** Shows a spinner, disables the button and replaces the text with `loadingLabel`. */
    loading?: boolean;
    /** What is happening while loading, e.g. "Publicando…". */
    loadingLabel?: ReactNode;
    icon?: ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  icon,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
