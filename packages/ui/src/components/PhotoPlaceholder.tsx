import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

/**
 * Stand-in for a property photo in demo data: a blueprint grid with a caption ("Foto 1 · sala com
 * varanda"). Real photos replace it once storage is wired. Decorative unless `label` is given.
 */
export function PhotoPlaceholder({
  caption,
  label,
  className,
  children,
}: {
  caption?: ReactNode;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-ink-100 text-[13px] text-action-hover',
        className,
      )}
      style={{
        backgroundImage:
          'linear-gradient(var(--color-ink-200) 1px, transparent 1px), linear-gradient(90deg, var(--color-ink-200) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '-1px -1px',
      }}
    >
      {caption ? (
        <span className="rounded-chip bg-ink-100/80 px-1.5 text-center">{caption}</span>
      ) : null}
      {children}
    </div>
  );
}
