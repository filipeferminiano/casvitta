import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { buttonVariants } from './Button.tsx';

/**
 * Building blocks for the SEO price, building, financing and street pages. Presentational and
 * server-renderable: links are plain <a href> so everything works without JavaScript. Counts
 * only where the boards say so; never a single sale or an exact date.
 */

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

// --- ZoneFilter -----------------------------------------------------------------------------

export type ZoneFilterOption = { key: string; label: ReactNode; href: string; selected?: boolean };

export type ZoneFilterProps = {
  /** Accessible name, e.g. "Filtrar por zona". */
  label: string;
  options: ZoneFilterOption[];
  className?: string;
};

/** Todas / Centro / Sul / Oeste / Norte / Leste as links (query params): works without JS. */
export function ZoneFilter({ label, options, className }: ZoneFilterProps) {
  return (
    <nav aria-label={label} className={cn('-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0', className)}>
      <ul className="inline-flex gap-1 rounded-control border border-line bg-panel p-1">
        {options.map((option) => (
          <li key={option.key} className="shrink-0">
            <a
              href={option.href}
              aria-current={option.selected ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-control px-4 type-body-s font-medium whitespace-nowrap',
                focus,
                option.selected ? 'bg-fg text-white' : 'text-fg hover:bg-subtle',
              )}
            >
              {option.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// --- BuildingFactsRow -----------------------------------------------------------------------

export type BuildingFact = { key: string; text: ReactNode };

export type BuildingFactsRowProps = {
  /** Accessible name, e.g. "Dados do prédio". */
  label: string;
  /** Missing facts are simply omitted: null/undefined/false entries are dropped. */
  facts: (BuildingFact | null | undefined | false)[];
  className?: string;
};

/** Year · floors · units · standard (IPTU) as mono chips; only the facts we have. */
export function BuildingFactsRow({ label, facts, className }: BuildingFactsRowProps) {
  const present = facts.filter((f): f is BuildingFact => Boolean(f));
  if (!present.length) return null;
  return (
    <ul aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {present.map((fact) => (
        <li
          key={fact.key}
          className="inline-flex items-center rounded-chip border border-line bg-panel px-2 py-1 font-mono text-[13px] leading-5 tabular text-fg"
        >
          {fact.text}
        </li>
      ))}
    </ul>
  );
}

// --- SalesPerYearBars -----------------------------------------------------------------------

export type SalesPerYearBar = {
  /** "2019"; partial years are marked by `partial`. */
  year: string;
  count: number;
  partial?: boolean;
};

export type SalesPerYearBarsProps = {
  title: string;
  bars: SalesPerYearBar[];
  /** Accessible text per bar, e.g. (n) => `${n} vendas`. */
  formatCount: (count: number) => string;
  /** Footnote for the partial year, e.g. "*2026 até agosto". */
  partialNote?: ReactNode;
  className?: string;
};

/** Simple bars of sales per year. Counts only, never a price per sale. */
export function SalesPerYearBars({
  title,
  bars,
  formatCount,
  partialNote,
  className,
}: SalesPerYearBarsProps) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="type-body-s font-medium text-fg">{title}</figcaption>
      <ol className="flex h-32 items-end gap-2" aria-label={title}>
        {bars.map((bar) => (
          <li
            key={bar.year}
            className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="font-mono text-[12px] tabular text-fg" aria-hidden="true">
              {bar.count}
            </span>
            <span
              aria-hidden="true"
              className={cn('w-full rounded-t-chip', bar.partial ? 'bg-ink-300' : 'bg-ink-700')}
              style={{ height: `${Math.max(4, (bar.count / max) * 100)}%` }}
            />
            <span className="font-mono text-[12px] tabular text-fg-muted" aria-hidden="true">
              {bar.year}
              {bar.partial ? '*' : ''}
            </span>
            <span className="sr-only">
              {bar.year}
              {bar.partial ? '*' : ''}: {formatCount(bar.count)}
            </span>
          </li>
        ))}
      </ol>
      {partialNote ? <p className="type-caption">{partialNote}</p> : null}
    </figure>
  );
}

// --- OwnerCTA -------------------------------------------------------------------------------

export type OwnerCtaAction = { key: string; label: ReactNode; href: string };

export type OwnerCTAProps = {
  title: ReactNode;
  description?: ReactNode;
  /** One or two actions; the first is primary. */
  actions: [OwnerCtaAction] | [OwnerCtaAction, OwnerCtaAction];
  headingLevel?: 'h2' | 'h3';
  className?: string;
};

/** Yellow-50 panel for owners ("Você mora neste prédio?"). */
export function OwnerCTA({
  title,
  description,
  actions,
  headingLevel: Heading = 'h2',
  className,
}: OwnerCTAProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-card border border-attention-line bg-attention-subtle p-5',
        className,
      )}
    >
      <Heading className="type-title text-[20px] leading-7">{title}</Heading>
      {description ? <p className="type-body-s text-fg-strong">{description}</p> : null}
      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => (
          <a
            key={action.key}
            href={action.href}
            className={buttonVariants({ variant: index === 0 ? 'primary' : 'secondary' })}
          >
            {action.label}
          </a>
        ))}
      </div>
    </section>
  );
}

// --- BuildingList ---------------------------------------------------------------------------

export type BuildingListItem = {
  key: string;
  /** Display name, already built ("Edifício nº 1.410" for unnamed buildings). */
  name: ReactNode;
  href?: string;
  /** Secondary line, e.g. "1998 · 56 apartamentos". */
  meta?: ReactNode;
  /** Right side, counts only, e.g. "12 vendas". */
  aside?: ReactNode;
};

export type BuildingListProps = {
  /** Accessible name, e.g. "Outros prédios na Rua Joaquim Távora". */
  label: string;
  items: BuildingListItem[];
  footer?: ReactNode;
  className?: string;
};

/** Other buildings on a street: a tap list (whole row is the link). */
export function BuildingList({ label, items, footer, className }: BuildingListProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul
        aria-label={label}
        className="divide-y divide-line rounded-card border border-line bg-panel"
      >
        {items.map((item) => {
          const body = (
            <>
              <span className="flex flex-col">
                <span className={cn('font-semibold', item.href ? 'text-action' : 'text-fg')}>
                  {item.name}
                </span>
                {item.meta ? <span className="type-caption">{item.meta}</span> : null}
              </span>
              {item.aside ? (
                <span className="font-mono text-[13px] tabular text-fg-muted">{item.aside}</span>
              ) : null}
            </>
          );
          const row = 'flex min-h-14 items-center justify-between gap-3 px-4 py-2 type-body-s';
          return (
            <li key={item.key}>
              {item.href ? (
                <a href={item.href} className={cn(row, 'hover:bg-subtle', focus)}>
                  {body}
                </a>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {footer ? <div className="type-body-s text-fg-muted">{footer}</div> : null}
    </div>
  );
}

// --- StreetQuickLinks -----------------------------------------------------------------------

export type StreetQuickLink = {
  key: string;
  title: ReactNode;
  href: string;
  /** Count of real listings; omit/null to show only `caption` ("Avise-me quando houver"). */
  count?: number | null;
  /** "anúncios com CRECI", "Avise-me quando houver" or "Estimativa grátis". */
  caption: ReactNode;
};

export type StreetQuickLinksProps = {
  label: string;
  links: StreetQuickLink[];
  className?: string;
};

/** Three shortcuts at the top of the street page: sale, rent, valuation. */
export function StreetQuickLinks({ label, links, className }: StreetQuickLinksProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="grid gap-3 sm:grid-cols-3">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              className={cn(
                'flex min-h-20 items-center justify-between gap-3 rounded-card border border-line bg-panel p-4 hover:border-action',
                focus,
              )}
            >
              <span className="flex flex-col">
                <span className="type-body-s font-semibold text-fg">{link.title}</span>
                <span className="type-caption">{link.caption}</span>
              </span>
              {link.count != null ? (
                <span className="type-value text-fg" data-testid="quick-link-count">
                  {link.count}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// --- StockBlock -----------------------------------------------------------------------------

export type StockTile = { key: string; label: ReactNode; value: ReactNode; caption?: ReactNode };

export type StandardMixSegment = {
  key: string;
  label: string;
  /** 0..1 */
  share: number;
  /** "62%". */
  display: string;
};

export type StockBlockProps = {
  title: ReactNode;
  tiles: StockTile[];
  /** Construction standard mix (IPTU); omitted for houses-only streets. */
  standardMix?: { label: ReactNode; segments: StandardMixSegment[] } | null;
  /** 'houses': street with no residential building (tiles describe houses and lots). */
  variant?: 'buildings' | 'houses';
  className?: string;
};

const MIX_TONES = ['bg-ink-700', 'bg-ink-300', 'bg-ink-200', 'bg-ink-100'];

/** What exists on a street (IPTU register): units, buildings, year, size, standard mix. */
export function StockBlock({
  title,
  tiles,
  standardMix,
  variant = 'buildings',
  className,
}: StockBlockProps) {
  return (
    <section data-variant={variant} className={cn('flex flex-col gap-3', className)}>
      <h2 className="type-title">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="flex flex-col gap-1 rounded-card border border-line bg-panel p-4"
          >
            <dt className="type-body-s text-fg-muted">{tile.label}</dt>
            <dd className="type-value text-fg">{tile.value}</dd>
            {tile.caption ? <dd className="type-caption">{tile.caption}</dd> : null}
          </div>
        ))}
      </dl>
      {standardMix && variant === 'buildings' ? (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-panel p-4">
          <p className="type-body-s text-fg-muted">{standardMix.label}</p>
          <div className="flex h-3 w-full overflow-hidden rounded-pill" aria-hidden="true">
            {standardMix.segments.map((segment, index) => (
              <span
                key={segment.key}
                className={MIX_TONES[index % MIX_TONES.length]}
                style={{ width: `${Math.round(segment.share * 100)}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 type-body-s">
            {standardMix.segments.map((segment, index) => (
              <li key={segment.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block size-3 rounded-chip',
                    MIX_TONES[index % MIX_TONES.length],
                  )}
                />
                {segment.label} <span className="font-mono tabular">{segment.display}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// --- TurnoverLine ---------------------------------------------------------------------------

export type TurnoverLineProps = {
  /** "15%"; the caller omits the component below its thresholds. */
  value: ReactNode;
  /** "das unidades desta rua foram vendidas nos últimos 3 anos." */
  text: ReactNode;
  /** "Na Vila Mariana, 12%." */
  comparison?: ReactNode;
  className?: string;
};

export function TurnoverLine({ value, text, comparison, className }: TurnoverLineProps) {
  return (
    <p className={cn('type-body text-fg-strong', className)}>
      <strong className="font-mono font-semibold tabular text-fg">{value}</strong> {text}
      {comparison ? <> {comparison}</> : null}
    </p>
  );
}

// --- StickyResultBar ------------------------------------------------------------------------

export type StickyResultBarProps = {
  /** Accessible name and visible label, e.g. "Renda indicada · simulação". */
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  secondary?: { label: ReactNode; value: ReactNode };
  action?: { label: ReactNode; href: string };
  className?: string;
};

/** Mobile result pinned to the bottom (ITBI, financing). Hidden from md up. */
export function StickyResultBar({
  label,
  value,
  suffix,
  secondary,
  action,
  className,
}: StickyResultBarProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-panel px-4 py-3 md:hidden',
        className,
      )}
    >
      <div className="flex flex-col">
        <span className="type-caption">{label}</span>
        <span className="font-mono text-[18px] leading-6 font-semibold tabular text-fg">
          {value}
          {suffix ? <span className="type-caption font-sans font-normal"> {suffix}</span> : null}
        </span>
        {secondary ? (
          <span className="type-caption">
            {secondary.label} <span className="font-mono tabular text-fg">{secondary.value}</span>
          </span>
        ) : null}
      </div>
      {action ? (
        <a href={action.href} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {action.label}
        </a>
      ) : null}
    </section>
  );
}

// --- IncomeNeededResult ---------------------------------------------------------------------

export type IncomeResultRow = { label: ReactNode; value: ReactNode };

export type IncomeNeededResultProps = {
  /** "Renda familiar mínima indicada". */
  title: ReactNode;
  /** Mandatory "Simulação · não é aprovação" badge. */
  badge: ReactNode;
  /** Formatted income ("R$ 23.780"); null when the inputs are invalid. */
  value: string | null;
  perMonth?: ReactNode;
  /** "parcela de até 30% da renda · financiamento de R$ 600.000". */
  summary?: ReactNode;
  /** SAC shows first and last installment; Price shows the fixed one. */
  installments:
    | { system: 'sac'; first: IncomeResultRow; last: IncomeResultRow }
    | { system: 'price'; fixed: IncomeResultRow };
  totalInterest?: IncomeResultRow;
  /** "Taxa ilustrativa de 11,5% a.a.". */
  rate?: ReactNode;
  /** "Seguros e tarifas não incluídos. Simulação, não é aprovação de crédito." */
  footnote?: ReactNode;
  /** Invalid inputs (e.g. down payment below the minimum): dashed outline and this message. */
  invalidMessage?: ReactNode;
  className?: string;
};

export function IncomeNeededResult({
  title,
  badge,
  value,
  perMonth,
  summary,
  installments,
  totalInterest,
  rate,
  footnote,
  invalidMessage,
  className,
}: IncomeNeededResultProps) {
  const invalid = Boolean(invalidMessage) || value === null;
  const rows: IncomeResultRow[] = invalid
    ? []
    : installments.system === 'sac'
      ? [installments.first, installments.last]
      : [installments.fixed];
  if (!invalid && totalInterest) rows.push(totalInterest);
  return (
    <section
      aria-live="polite"
      data-system={installments.system}
      data-invalid={invalid ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-card border bg-panel p-5',
        invalid ? 'border-dashed border-line-dashed' : 'border-line',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-body-s font-medium text-fg-muted">{title}</h3>
        {invalid ? null : badge}
      </div>
      <p className="font-mono text-[32px] leading-10 font-semibold tabular text-fg">
        {invalid ? 'R$ —' : value}
        {!invalid && perMonth ? (
          <span className="type-body-s font-sans font-normal text-fg-muted"> {perMonth}</span>
        ) : null}
      </p>
      {invalid ? (
        <p className="type-body-s text-fg-muted">{invalidMessage}</p>
      ) : (
        <>
          {summary ? <p className="type-body-s text-fg-strong">{summary}</p> : null}
          <dl className="flex flex-col divide-y divide-line border-t border-line">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-2 type-body-s">
                <dt className="text-fg-muted">{row.label}</dt>
                <dd className="font-mono tabular text-fg">{row.value}</dd>
              </div>
            ))}
          </dl>
          {rate ? <p className="type-caption">{rate}</p> : null}
          {footnote ? <p className="type-caption">{footnote}</p> : null}
        </>
      )}
    </section>
  );
}
