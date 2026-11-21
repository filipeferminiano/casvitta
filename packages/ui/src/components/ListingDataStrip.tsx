import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ListingDataStripProps = {
  /** Rent: "Antes de alugar, veja os prédios". Sale: "Preço real pago nesta região". */
  title: ReactNode;
  description?: ReactNode;
  /** BuildingList (rent) or StatTiles (sale). */
  children: ReactNode;
  /** SourceNote or a link to the price page. */
  footer?: ReactNode;
  className?: string;
};

/** The data that sets the listing pages apart: buildings (rent) or prices actually paid (sale). */
export function ListingDataStrip({
  title,
  description,
  children,
  footer,
  className,
}: ListingDataStripProps) {
  return (
    <section
      className={cn('flex flex-col gap-4 rounded-card border border-line bg-panel p-5', className)}
    >
      <div className="flex flex-col gap-1">
        <h2 className="type-title">{title}</h2>
        {description ? <p className="type-body-s text-fg-muted">{description}</p> : null}
      </div>
      {children}
      {footer}
    </section>
  );
}
