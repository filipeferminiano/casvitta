import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type AudienceCardProps = {
  title: ReactNode;
  description: ReactNode;
  /** Usually a link ("Anunciar meu imóvel ›"). */
  action: ReactNode;
  /** "Em breve" badge; the card gets a dashed border. */
  soon?: ReactNode;
  className?: string;
};

/** "Você é…" cards on the home (51): one per audience, each with its own entry path. */
export function AudienceCard({ title, description, action, soon, className }: AudienceCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-card bg-panel p-5 text-fg',
        soon ? 'border border-dashed border-line-dashed' : 'border border-line',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="type-title text-[20px]">{title}</h3>
        {soon}
      </header>
      <p className="flex-1 type-body-s text-fg-strong">{description}</p>
      <div className="mt-1 type-body-s font-semibold text-action">{action}</div>
    </article>
  );
}
