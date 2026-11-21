import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type ComparisonPlan = {
  key: string;
  name: ReactNode;
  /** Formatted price from config, or text such as "Sob consulta". */
  price: ReactNode;
  /** "por mês"; omitted when the price is not a number. */
  period?: ReactNode;
  highlighted?: boolean;
  action: ReactNode;
};

/** `true` renders a check with `includedLabel` for screen readers. */
export type ComparisonValue = ReactNode | true;

export type ComparisonRow = { key: string; label: ReactNode; values: ComparisonValue[] };

export type PlanComparisonTableProps = {
  /** Accessible caption of the table ("Comparação dos planos"). */
  caption: string;
  /** Header of the first column on desktop (visually hidden). */
  featureHeader: string;
  plans: ComparisonPlan[];
  rows: ComparisonRow[];
  includedLabel: string;
  className?: string;
};

function Value({ value, includedLabel }: { value: ComparisonValue; includedLabel: string }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden="true" strokeWidth={2} className="size-4 text-success" />
        <span className="sr-only">{includedLabel}</span>
      </>
    );
  }
  return <>{value}</>;
}

/**
 * Plans side by side (agencies page): a real table from md up, one card per plan on phones.
 * Same rows in both; the highlighted plan gets a blue-50 column / 2px blue border.
 */
export function PlanComparisonTable({
  caption,
  featureHeader,
  plans,
  rows,
  includedLabel,
  className,
}: PlanComparisonTableProps) {
  return (
    <div className={className}>
      <div className="hidden overflow-hidden rounded-card border border-line bg-panel md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[30%] p-4">
                <span className="sr-only">{featureHeader}</span>
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.key}
                  scope="col"
                  className={cn('p-4 align-bottom', plan.highlighted && 'bg-action-subtle')}
                >
                  <span className="block type-body font-semibold">{plan.name}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[22px] leading-7 font-semibold tabular">
                      {plan.price}
                    </span>
                    {plan.period ? (
                      <span className="type-caption font-normal">{plan.period}</span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <th scope="row" className="p-4 type-body-s font-medium">
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={plans[i]?.key ?? i}
                    className={cn(
                      'p-4 type-body-s text-fg-strong',
                      plans[i]?.highlighted && 'bg-action-subtle',
                    )}
                  >
                    <Value value={value} includedLabel={includedLabel} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td />
              {plans.map((plan) => (
                <td
                  key={plan.key}
                  className={cn('p-4 [&>*]:w-full', plan.highlighted && 'bg-action-subtle')}
                >
                  {plan.action}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-4 md:hidden">
        {plans.map((plan, p) => (
          <li
            key={plan.key}
            className={cn(
              'flex flex-col gap-4 rounded-card bg-panel p-5',
              plan.highlighted ? 'border-2 border-action' : 'border border-line',
            )}
          >
            <div>
              <h3 className="type-title">{plan.name}</h3>
              <p className="flex items-baseline gap-1.5">
                <span className="font-mono text-[26px] leading-8 font-semibold tabular">
                  {plan.price}
                </span>
                {plan.period ? <span className="type-caption">{plan.period}</span> : null}
              </p>
            </div>
            <dl className="flex flex-col">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 border-t border-line py-2"
                >
                  <dt className="type-body-s">{row.label}</dt>
                  <dd className="flex shrink-0 items-center text-right type-body-s text-fg-strong">
                    <Value value={row.values[p]} includedLabel={includedLabel} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="[&>*]:w-full">{plan.action}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
