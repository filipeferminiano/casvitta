import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type PlanCardProps = {
  name: ReactNode;
  /** Formatted price ("R$ 397"). */
  price: ReactNode;
  period: ReactNode;
  features: ReactNode[];
  action: ReactNode;
  /** 2px blue border for the plan to highlight. */
  highlighted?: boolean;
  badge?: ReactNode;
  className?: string;
};

/** Plan with price and included features (mockup 54). Prices come from config, never literals. */
export function PlanCard({
  name,
  price,
  period,
  features,
  action,
  highlighted,
  badge,
  className,
}: PlanCardProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-card bg-panel p-6',
        highlighted ? 'border-2 border-action' : 'border border-line',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="type-title">{name}</h3>
        {badge}
      </header>
      <p className="flex items-baseline gap-1">
        <span className="type-value text-[30px] leading-9">{price}</span>
        <span className="type-body-s text-fg-muted">{period}</span>
      </p>
      <ul className="flex flex-1 flex-col gap-2">
        {features.map((feature, i) => (
          <li key={i} className="flex gap-2 type-body-s text-fg-strong">
            <Check
              aria-hidden="true"
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0 text-success"
            />
            {feature}
          </li>
        ))}
      </ul>
      <div className="[&>*]:w-full">{action}</div>
    </section>
  );
}
