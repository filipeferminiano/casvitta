import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

/** Browser chrome around a landing-page preview (address bar shows the real URL). */
export function BrowserFrame({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-panel', className)}>
      <div className="flex items-center gap-2 border-b border-line bg-subtle px-3 py-2">
        <span aria-hidden="true" className="flex gap-1">
          <span className="size-2.5 rounded-pill bg-ink-300" />
          <span className="size-2.5 rounded-pill bg-ink-300" />
          <span className="size-2.5 rounded-pill bg-ink-300" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-chip bg-panel px-2 py-0.5 font-mono text-[12px] text-fg-strong">
          {url}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Phone outline for mobile previews. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mx-auto w-[300px] rounded-[32px] border-[6px] border-fg bg-panel p-1 shadow-menu',
        className,
      )}
    >
      <div className="mx-auto mb-1 h-1.5 w-16 rounded-pill bg-ink-200" aria-hidden="true" />
      <div className="overflow-hidden rounded-[22px] border border-line">{children}</div>
    </div>
  );
}
