import type { ReactNode } from 'react';

import { StatusPill } from '../components/StatusPill.tsx';

export type CheckListItem = {
  key: string;
  label: ReactNode;
  outcome: 'ok' | 'review' | 'fail';
  outcomeLabel: string;
};

/** "Checagens automáticas" (BO6): one line per check with its outcome in words and color. */
export function CheckList({ title, items }: { title: ReactNode; items: CheckListItem[] }) {
  return (
    <section>
      <h3 className="type-body-s font-semibold">{title}</h3>
      <ul className="mt-1 flex flex-col">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0"
          >
            <span className="type-body-s">{item.label}</span>
            <StatusPill
              tone={
                item.outcome === 'ok'
                  ? 'success'
                  : item.outcome === 'review'
                    ? 'attention'
                    : 'danger'
              }
            >
              {item.outcomeLabel}
            </StatusPill>
          </li>
        ))}
      </ul>
    </section>
  );
}
