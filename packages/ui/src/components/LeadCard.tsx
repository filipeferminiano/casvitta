import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type LeadCardProps = {
  /** Name, usually a link with `cardLinkClass` so the whole card opens the lead. */
  name: ReactNode;
  /** "Instagram · Apto Vila Mariana". */
  origin: ReactNode;
  /** Media cost of the lead, already formatted ("R$ 12"); top right, mono. */
  cost?: ReactNode;
  /** Qualification or status chips. */
  chips?: ReactNode;
  /** Footer line ("há 8 min", "IA passou para você"). */
  note?: ReactNode;
  /** 4px yellow left stripe: a human must act. */
  needsHuman?: boolean;
  /** Slot for the "Mover para…" menu. */
  menu?: ReactNode;
  className?: string;
};

/** Classes for the link passed as `name`: it stretches over the whole card. */
export const cardLinkClass =
  'after:absolute after:inset-0 hover:underline focus-visible:outline-none';

/** Kanban card (DESIGN_SYSTEM §6). */
export function LeadCard({
  name,
  origin,
  cost,
  chips,
  note,
  needsHuman,
  menu,
  className,
}: LeadCardProps) {
  return (
    <article
      className={cn(
        'relative flex flex-col gap-2 rounded-control border border-line border-l-4 bg-panel py-3 pr-3 pl-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
        needsHuman ? 'border-l-attention' : 'border-l-ink-200',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] leading-5 font-semibold text-fg">{name}</h3>
        <div className="relative z-10 flex items-center gap-1">
          {cost ? (
            <span className="font-mono text-[12px] leading-5 tabular text-fg-muted">{cost}</span>
          ) : null}
          {menu}
        </div>
      </div>
      <p className="-mt-1.5 truncate text-[13px] leading-[18px] text-fg-muted">{origin}</p>
      {chips ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null}
      {note ? <p className="type-caption text-fg-muted">{note}</p> : null}
    </article>
  );
}
