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
  /** Extra lines under the specs (simulated installment, investment estimate). */
  extra?: ReactNode;
  /** Small line above the title ("Apartamento à venda"). */
  kicker?: ReactNode;
  /** Horizontal for result lists (mockup 53); vertical for grids. */
  layout?: 'vertical' | 'horizontal';
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
  extra,
  kicker,
  layout = 'vertical',
  className,
}: PropertyCardProps) {
  const horizontal = layout === 'horizontal';
  return (
    <article
      className={cn(
        'relative flex overflow-hidden rounded-card border border-line bg-panel has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
        horizontal ? 'flex-col sm:flex-row' : 'flex-col',
        className,
      )}
    >
      <PhotoPlaceholder
        caption={photoCaption}
        className={
          horizontal
            ? 'aspect-[4/3] w-full shrink-0 sm:aspect-auto sm:w-[220px]'
            : 'aspect-[16/10] w-full'
        }
      >
        {badges ? <div className="absolute top-2 left-2 flex gap-1.5">{badges}</div> : null}
      </PhotoPlaceholder>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-1 p-4">
          {kicker ? <p className="type-caption">{kicker}</p> : null}
          <h3
            className={
              horizontal ? 'type-body font-semibold text-fg' : 'type-body-s text-fg-strong'
            }
          >
            {title}
          </h3>
          <p className="type-value text-[22px]">{price}</p>
          <p className="type-body-s text-fg-strong">{specs}</p>
          {extra}
        </div>
        <footer
          className={cn(
            'mt-auto flex flex-wrap items-center gap-2 type-caption text-fg-strong',
            horizontal ? 'px-4 pb-4' : 'border-t border-line px-4 py-3',
          )}
        >
          {broker}
        </footer>
      </div>
    </article>
  );
}
