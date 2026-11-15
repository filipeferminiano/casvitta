import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { PhotoPlaceholder } from './PhotoPlaceholder.tsx';

export type PropertyRowProps = {
  title: ReactNode;
  /** "Vila Mariana · 2 quartos · 68 m² · 1 vaga · 9 fotos". */
  details: ReactNode;
  /** Price, already formatted (mono). */
  price: ReactNode;
  /** Status line: StatusPill, authorization chip, counts. */
  status?: ReactNode;
  /** Extra line under the status (e.g. "Anexar autorização assinada"). */
  footer?: ReactNode;
  photoCaption?: ReactNode;
  /** Left control (radio) for pickers. */
  control?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Operations list row (DESIGN_SYSTEM §6): thumbnail, address, details, price, status. */
export function PropertyRow({
  title,
  details,
  price,
  status,
  footer,
  photoCaption,
  control,
  selected,
  disabled,
  className,
}: PropertyRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-card bg-panel p-3.5',
        selected ? 'border-2 border-action p-[13px]' : 'border border-line',
        disabled && 'bg-panel',
        className,
      )}
    >
      {control}
      <PhotoPlaceholder
        caption={photoCaption}
        className="hidden h-[84px] w-[120px] shrink-0 rounded-control sm:flex"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="type-body font-semibold">{title}</p>
        <p className="type-body-s text-fg-muted">{details}</p>
        {status ? <div className="flex flex-wrap gap-2">{status}</div> : null}
        {footer}
      </div>
      <p className="shrink-0 text-right font-mono text-[18px] leading-6 font-semibold tabular">
        {price}
      </p>
    </div>
  );
}
