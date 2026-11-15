import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ModuleCardProps = {
  state: 'active' | 'available' | 'soon';
  icon: ReactNode;
  /** State pill ("Ativo", "Disponível", "Em breve"). */
  pill: ReactNode;
  name: ReactNode;
  description: ReactNode;
  /** Mono price/plan line. */
  priceLine: ReactNode;
  action: ReactNode;
  className?: string;
};

/**
 * Module store card (DESIGN_SYSTEM §6): Ativo (green pill, "Gerenciar"), Disponível (2px blue border,
 * primary "Ativar"), Em breve (dashed border, "Quero ser avisado" — records interest only).
 */
export function ModuleCard({
  state,
  icon,
  pill,
  name,
  description,
  priceLine,
  action,
  className,
}: ModuleCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-card bg-panel p-4',
        state === 'available'
          ? 'border-2 border-action'
          : state === 'soon'
            ? 'border border-dashed border-line-dashed'
            : 'border border-line',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="text-fg [&_svg]:size-5">
          {icon}
        </span>
        {pill}
      </div>
      <h3 className="type-title text-[19px] leading-6">{name}</h3>
      <p className="flex-1 type-body-s text-fg-muted">{description}</p>
      <p className="font-mono type-caption text-fg-strong">{priceLine}</p>
      <div className="mt-1 [&>*]:w-full">{action}</div>
    </article>
  );
}
