'use client';

import { DropdownMenu as Radix } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export const DropdownMenu = Radix.Root;
export const DropdownMenuTrigger = Radix.Trigger;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content
        sideOffset={4}
        align="end"
        className={cn(
          'z-50 min-w-48 rounded-card border border-line bg-panel p-1 shadow-menu',
          className,
        )}
        {...props}
      />
    </Radix.Portal>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Radix.Label>) {
  return <Radix.Label className={cn('px-3 py-2 type-caption font-medium', className)} {...props} />;
}

export function DropdownMenuItem({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof Radix.Item> & { icon?: ReactNode }) {
  return (
    <Radix.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 type-body-s text-fg outline-none select-none',
        'data-highlighted:bg-action-subtle data-disabled:cursor-not-allowed data-disabled:text-disabled-text',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Radix.Item>
  );
}
