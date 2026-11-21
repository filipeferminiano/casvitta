import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

/** Bulleted list with a check (included) or a dash (not included). */
export function CheckList({
  items,
  tone = 'included',
  className,
}: {
  items: ReactNode[];
  tone?: 'included' | 'excluded';
  className?: string;
}) {
  const Icon = tone === 'included' ? Check : Minus;
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {items.map((item, i) => (
        <li
          key={i}
          className={cn(
            'flex gap-2 type-body-s',
            tone === 'included' ? 'text-fg-strong' : 'text-fg-muted',
          )}
        >
          <Icon
            aria-hidden="true"
            strokeWidth={2}
            className={cn(
              'mt-0.5 size-4 shrink-0',
              tone === 'included' ? 'text-success' : 'text-ink-300',
            )}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

export type OfferCardProps = {
  /** "1 imóvel por 30 dias", "Plano Corretor". */
  name: ReactNode;
  /** AudienceTag(s) next to the name. */
  tags?: ReactNode;
  /** Formatted from config ("R$ 59"); never a literal in the page. */
  price: ReactNode;
  /** "pagamento único", "por mês". */
  period: ReactNode;
  included: { title?: ReactNode; items: ReactNode[] };
  /** Optional "Não inclui" column, shown beside the included list on wide cards. */
  excluded?: { title: ReactNode; items: ReactNode[] };
  action: ReactNode;
  /** Small print under the action. */
  note?: ReactNode;
  /** 2px blue border. */
  highlighted?: boolean;
  /** Heading level for the name (default h3). */
  as?: 'h2' | 'h3';
  className?: string;
};

/**
 * A priced offer on the audience pages: owner packs, the broker plan. Prices come from config;
 * the card has no promotion, discount or "trial" slot on purpose.
 */
export function OfferCard({
  name,
  tags,
  price,
  period,
  included,
  excluded,
  action,
  note,
  highlighted,
  as: Heading = 'h3',
  className,
}: OfferCardProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-5 rounded-card bg-panel p-5 md:p-6',
        highlighted ? 'border-2 border-action' : 'border border-line',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <Heading className="type-title">{name}</Heading>
        {tags ? <div className="flex flex-wrap gap-1.5">{tags}</div> : null}
      </header>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-[36px] leading-10 font-semibold tabular">{price}</span>
        <span className="type-body-s text-fg-muted">{period}</span>
      </p>
      <div className={cn('grid flex-1 gap-5', excluded && 'md:grid-cols-2')}>
        <div className="flex flex-col gap-2">
          {included.title ? <p className="type-body-s font-semibold">{included.title}</p> : null}
          <CheckList items={included.items} />
        </div>
        {excluded ? (
          <div className="flex flex-col gap-2">
            <p className="type-body-s font-semibold">{excluded.title}</p>
            <CheckList items={excluded.items} tone="excluded" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 [&>a]:w-full [&>button]:w-full">{action}</div>
      {note ? <p className="type-caption">{note}</p> : null}
    </section>
  );
}

/** Icon + title + text card ("Benefícios", "Parece familiar?"). */
export function FeatureCard({
  icon,
  title,
  description,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn('flex flex-col gap-2 rounded-card border border-line bg-panel p-5', className)}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-2 flex size-9 items-center justify-center rounded-control bg-action-subtle text-action [&>svg]:size-4"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="type-body font-semibold">{title}</h3>
      <p className="type-body-s text-fg-strong">{description}</p>
    </article>
  );
}
