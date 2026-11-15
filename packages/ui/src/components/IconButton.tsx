import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-control transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:text-disabled-text disabled:bg-transparent',
    '[&_svg]:size-5',
  ],
  {
    variants: {
      variant: {
        ghost: 'text-fg hover:bg-subtle',
        secondary: 'border border-line bg-panel text-fg hover:bg-subtle',
        primary: 'bg-action text-fg-on-action hover:bg-action-hover disabled:bg-disabled-bg',
      },
      size: { md: 'size-11', sm: 'hit-area-44 size-9' },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> &
  VariantProps<typeof iconButtonVariants> & {
    /** Required accessible name: the button has no visible text. */
    label: string;
    icon: ReactNode;
  };

export function IconButton({
  label,
  icon,
  className,
  variant,
  size,
  type,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
    </button>
  );
}
