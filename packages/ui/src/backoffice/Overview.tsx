import { ChevronRight } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type QueueListItem = {
  key: string;
  title: ReactNode;
  description?: ReactNode;
  count: number;
  href: string;
  /** Yellow dot when someone must act now; grey when it can wait. */
  tone: 'attention' | 'neutral';
};

export type QueueListProps = {
  items: QueueListItem[];
  openLabel: string;
  /** Accessible name for each link, e.g. "Abrir CRECI para verificar (12)". */
  linkLabel: (item: QueueListItem) => string;
  linkAs?: ElementType;
};

/** "Precisa de você" (BO1): each queue with its size and a link to work on it. */
export function QueueList({ items, openLabel, linkLabel, linkAs: Link = 'a' }: QueueListProps) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-center gap-4 border-t border-line py-3 first:border-t-0"
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-2 shrink-0 rounded-pill',
              item.tone === 'attention' ? 'bg-attention' : 'bg-ink-300',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="type-body font-semibold text-fg">{item.title}</p>
            {item.description ? (
              <p className="type-body-s text-fg-muted">{item.description}</p>
            ) : null}
          </div>
          <span className="font-mono text-[18px] font-semibold tabular text-fg">{item.count}</span>
          <Link
            href={item.href}
            aria-label={linkLabel(item)}
            className="inline-flex min-h-11 items-center gap-0.5 rounded-control px-1 type-body-s font-semibold text-action hover:text-action-hover focus-visible:outline-2 focus-visible:outline-focus"
          >
            {openLabel}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type ActivityListProps = {
  items: { key: string; time: string; actor: string; text: ReactNode }[];
};

/** "Atividade da equipe" (BO1): latest staff and system actions, newest first. */
export function ActivityList({ items }: ActivityListProps) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-t border-line py-3 first:border-t-0"
        >
          <span className="font-mono type-body-s tabular text-fg-muted">{item.time}</span>
          <p className="type-body-s text-fg">
            <strong className="font-semibold">{item.actor}</strong> {item.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
