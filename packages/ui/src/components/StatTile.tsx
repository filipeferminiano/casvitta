import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type StatTileProps = {
  label: ReactNode;
  /** Already formatted, e.g. "R$ 96" or "3". Rendered in mono with tabular numbers. */
  value: ReactNode;
  caption?: ReactNode;
  /** Badge next to the label, e.g. "Demonstrativo". */
  badge?: ReactNode;
  /** 4px blue top border for the metric that matters most on the screen. */
  highlighted?: boolean;
  className?: string;
};

export function StatTile({ label, value, caption, badge, highlighted, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-card border border-line bg-panel p-4',
        highlighted && 'border-t-4 border-t-action pt-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="type-body-s text-fg-muted">{label}</span>
        {badge}
      </div>
      <span className="type-value text-fg">{value}</span>
      {caption ? <span className="type-caption">{caption}</span> : null}
    </div>
  );
}
