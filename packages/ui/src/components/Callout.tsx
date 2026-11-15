import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

const tones = {
  info: {
    box: 'bg-action-subtle text-fg-strong',
    icon: <Info strokeWidth={1.6} className="text-action" />,
  },
  attention: {
    box: 'border border-attention-line bg-attention-subtle text-fg-strong',
    icon: <TriangleAlert strokeWidth={1.6} className="text-attention-fg" />,
  },
  risk: {
    box: 'border border-danger/30 bg-danger-subtle text-fg-strong',
    icon: <CircleAlert strokeWidth={1.6} className="text-danger" />,
  },
} as const;

export type CalloutProps = {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Inline note: info (how it works), attention (small sample), risk (auction warnings). */
export function Callout({ tone = 'info', title, children, className }: CalloutProps) {
  const t = tones[tone];
  return (
    <aside className={cn('flex gap-3 rounded-control p-4 type-body-s', t.box, className)}>
      <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-4">
        {t.icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        <div className="flex flex-col gap-1.5">{children}</div>
      </div>
    </aside>
  );
}
