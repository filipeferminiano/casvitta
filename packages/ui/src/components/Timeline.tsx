import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type TimelineItem = {
  key: string;
  icon: ReactNode;
  /** Mono timestamp, e.g. "16/11 · 09h12". */
  time: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  tone?: 'neutral' | 'action' | 'success' | 'attention';
};

const tones = {
  neutral: 'text-fg-muted',
  action: 'text-action',
  success: 'text-success',
  attention: 'text-attention-fg',
};

/** Lead history: icon circle + mono timestamp + title + detail, joined by a vertical rule. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, index) => (
        <li key={item.key} className="relative flex gap-4 pb-5 last:pb-0">
          {index < items.length - 1 ? (
            <span aria-hidden="true" className="absolute top-9 bottom-0 left-[17px] w-px bg-line" />
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              'relative flex size-9 shrink-0 items-center justify-center rounded-pill border border-line bg-panel [&_svg]:size-4',
              tones[item.tone ?? 'neutral'],
            )}
          >
            {item.icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <span className="font-mono type-caption tabular">{item.time}</span>
            <span className="type-body font-semibold text-fg">{item.title}</span>
            {item.detail ? <span className="type-body-s text-fg-strong">{item.detail}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
