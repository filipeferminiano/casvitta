import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ComparableGroup = {
  key: string;
  /** "Apartamentos de 90–120 m² na Rua Joaquim Távora". */
  description: ReactNode;
  /** "mesma rua" / "mesmo bairro". */
  scope?: ReactNode;
  /** "62 vendas". */
  sales: ReactNode;
  /** "mediana R$ 775 mil" or "R$ 7.180/m²"; null when the group is below the threshold. */
  median: ReactNode | null;
};

export type ComparableGroupListProps = {
  /** "Como chegamos neste valor". */
  title: ReactNode;
  /** "Grupos de vendas parecidas. Nunca mostramos uma venda isolada." */
  description?: ReactNode;
  groups: ComparableGroup[];
  /** Shown instead of a median for small groups: "poucas vendas". */
  fewSalesLabel: ReactNode;
  className?: string;
};

/**
 * Groups of similar sales used in an estimate. Each row: description, count and median. A group
 * below the threshold arrives with `median: null` and shows only the count.
 */
export function ComparableGroupList({
  title,
  description,
  groups,
  fewSalesLabel,
  className,
}: ComparableGroupListProps) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="type-body-s font-semibold text-fg">{title}</h3>
        {description ? <p className="type-caption">{description}</p> : null}
      </div>
      <ul className="flex flex-col border-t border-line">
        {groups.map((group) => (
          <li
            key={group.key}
            className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="flex min-w-0 flex-col">
              <span className="type-body-s text-fg">{group.description}</span>
              {group.scope ? <span className="type-caption">{group.scope}</span> : null}
            </div>
            <div className="flex shrink-0 gap-3 font-mono type-body-s tabular sm:flex-col sm:items-end sm:gap-0">
              <span className="text-fg-strong">{group.sales}</span>
              {group.median === null ? (
                <span className="text-fg-muted">{fewSalesLabel}</span>
              ) : (
                <span className="text-fg">{group.median}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
