import { LayoutGrid, Megaphone, Star } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

/**
 * The three things the audience pages sell, kept visually apart everywhere:
 * - software: the management tool, by subscription (blue-50)
 * - portal: the property is visible on the Casvitta portal, in the normal search order (outlined ink)
 * - highlight: more exposure inside the portal, optional and paid apart (yellow-400, ink text)
 *
 * Publishing included in a plan never means a better position or Google/Meta campaigns; only
 * `highlight` is about exposure. Text comes from the caller (message catalog).
 */
export type AudienceTagKind = 'software' | 'portal' | 'highlight';

const STYLE: Record<AudienceTagKind, string> = {
  software: 'bg-action-subtle text-action-hover',
  portal: 'border border-fg bg-panel text-fg',
  highlight: 'bg-attention text-fg',
};

const ICON = { software: LayoutGrid, portal: Megaphone, highlight: Star } as const;

export function AudienceTag({
  kind,
  children,
  className,
}: {
  kind: AudienceTagKind;
  children: ReactNode;
  className?: string;
}) {
  const Icon = ICON[kind];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-chip px-1.5 py-0.5 text-[12px] leading-4 font-semibold whitespace-nowrap',
        STYLE[kind],
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={kind === 'highlight' ? 0 : 1.6}
        fill={kind === 'highlight' ? 'currentColor' : 'none'}
        className="size-3.5"
      />
      {children}
    </span>
  );
}

/** "Como diferenciamos as três coisas": each tag with one line of meaning (dashed box). */
export function AudienceTagLegend({
  items,
  label,
  className,
}: {
  items: { kind: AudienceTagKind; tag: ReactNode; meaning: ReactNode }[];
  /** Accessible name of the list. */
  label?: string;
  className?: string;
}) {
  return (
    <dl
      aria-label={label}
      className={cn(
        'flex flex-wrap gap-x-6 gap-y-2 rounded-card border border-dashed border-line-dashed bg-panel px-4 py-3',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.kind} className="flex flex-wrap items-center gap-2">
          <dt>
            <AudienceTag kind={item.kind}>{item.tag}</AudienceTag>
          </dt>
          <dd className="type-body-s text-fg-strong">{item.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
