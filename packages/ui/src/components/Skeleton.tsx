import { cn } from '../lib/cn.ts';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('h-4 animate-pulse rounded-chip bg-subtle', className)} />
  );
}
