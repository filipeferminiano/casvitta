import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { PhotoPlaceholder } from './PhotoPlaceholder.tsx';

export type PropertyCardProps = {
  /** "Apartamento · Vila Mariana". */
  title: ReactNode;
  price: ReactNode;
  /** "2 quartos · 68 m² · 1 vaga". */
  specs: ReactNode;
  /** Badges over the photo ("Destaque pago", "Demonstrativo"). */
  badges?: ReactNode;
  photoCaption?: ReactNode;
  /** Broker name + CRECI badge (mandatory on every listing). */
  broker: ReactNode;
  /** Usually a link wrapping the title. */
  className?: string;
};

/** Marketplace card (DESIGN_SYSTEM §6). The broker's CRECI is always in the footer. */
export function PropertyCard({
  title,
  price,
  specs,
  badges,
  photoCaption,
  broker,
  className,
}: PropertyCardProps) {
  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-card border border-line bg-panel',
        className,
      )}
    >
      <PhotoPlaceholder caption={photoCaption} className="aspect-[4/3] w-full">
        {badges ? <div className="absolute top-2 left-2 flex gap-1.5">{badges}</div> : null}
      </PhotoPlaceholder>
      <div className="flex flex-col gap-1 p-4">
        <h3 className="type-body-s text-fg-strong">{title}</h3>
        <p className="type-value text-[22px]">{price}</p>
        <p className="type-body-s text-fg-muted">{specs}</p>
      </div>
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 type-body-s">
        {broker}
      </footer>
    </article>
  );
}
