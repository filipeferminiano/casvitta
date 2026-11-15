'use client';

import { Tabs as RadixTabs } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  count,
  children,
  ...props
}: ComponentProps<typeof RadixTabs.Trigger> & { count?: ReactNode }) {
  return (
    <RadixTabs.Trigger
      className={cn(
        '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 type-body-s font-medium whitespace-nowrap text-fg-muted',
        'hover:text-fg data-[state=active]:border-action data-[state=active]:text-fg',
        'disabled:cursor-not-allowed disabled:text-disabled-text',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="rounded-pill bg-subtle px-2 font-mono text-[12px] leading-5 tabular text-fg-muted">
          {count}
        </span>
      ) : null}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content
      className={cn('pt-4 focus-visible:outline-2 focus-visible:outline-focus', className)}
      {...props}
    />
  );
}
