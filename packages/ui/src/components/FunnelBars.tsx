import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type FunnelItem = { key: string; label: ReactNode; value: number; display?: ReactNode };

export type FunnelBarsProps = {
  items: FunnelItem[];
  /** Accessible name for the chart. */
  label: string;
  /** Logarithmic scale, so very different magnitudes fit one ruler (add a caption saying so). */
  log?: boolean;
  /** Green fill for the last stage (DESIGN_SYSTEM: the outcome that matters). */
  highlightLast?: boolean;
  caption?: ReactNode;
  className?: string;
};

/** Horizontal bars: label, track (ink-100), fill (blue), value in mono. */
export function FunnelBars({
  items,
  label,
  log = false,
  highlightLast = false,
  caption,
  className,
}: FunnelBarsProps) {
  const scale = (v: number) => (log ? Math.log10(v + 1) : v);
  const max = Math.max(...items.map((i) => scale(i.value)), 1);
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <dl aria-label={label} className="flex flex-col gap-3">
        {items.map((item, index) => {
          const pct = (scale(item.value) / max) * 100;
          const last = index === items.length - 1;
          return (
            <div
              key={item.key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-3"
            >
              <dt className="type-body-s text-fg">{item.label}</dt>
              <dd className="h-4.5 overflow-hidden rounded-chip bg-subtle" aria-hidden="true">
                <div
                  className={cn(
                    'h-full rounded-chip',
                    highlightLast && last ? 'bg-success' : 'bg-action',
                  )}
                  style={{ width: `${Math.max(pct, item.value > 0 ? 4 : 0)}%` }}
                />
              </dd>
              <dd className="text-right font-mono type-body-s font-semibold tabular text-fg">
                {item.display ?? item.value}
              </dd>
            </div>
          );
        })}
      </dl>
      {caption ? <figcaption className="type-caption">{caption}</figcaption> : null}
    </figure>
  );
}
