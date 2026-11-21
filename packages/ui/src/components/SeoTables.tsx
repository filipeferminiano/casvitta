import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

/**
 * Tables for the SEO price pages. Prices are optional: a null price renders the count-only
 * "poucas vendas" text, never a number from a group below the threshold. Signed changes come
 * as text ("+1,8%"), so meaning never depends on color.
 */

const shell = 'overflow-x-auto rounded-card border border-line bg-panel';
const th = 'border-b border-line px-4 py-2.5 type-caption font-medium whitespace-nowrap';
const td = 'px-4 py-3 text-fg';
const num = 'text-right font-mono tabular';

function Table({
  caption,
  showCaption,
  className,
  children,
}: {
  caption: string;
  showCaption?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(shell, className)} role="region" aria-label={caption} tabIndex={0}>
      <table className="w-full border-collapse type-body-s">
        <caption className={cn(showCaption ? 'p-4 text-left type-title' : 'sr-only')}>
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

function Name({ href, children }: { href?: string; children: ReactNode }) {
  return href ? (
    <a
      href={href}
      className="inline-flex min-h-11 items-center font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </a>
  ) : (
    <span className="font-semibold">{children}</span>
  );
}

function Price({ value, fewSales }: { value?: string | null; fewSales: string }) {
  return value ? <>{value}</> : <span className="font-sans text-fg-muted">{fewSales}</span>;
}

// --- AreaBandTable --------------------------------------------------------------------------

export type AreaBandRow = {
  key: string;
  /** "Até 50 m²", "50–80 m²". */
  label: ReactNode;
  sales: string;
  medianValue?: string | null;
  medianPriceM2?: string | null;
};

export type AreaBandTableProps = {
  caption: string;
  showCaption?: boolean;
  rows: AreaBandRow[];
  labels: {
    band: ReactNode;
    sales: ReactNode;
    median: ReactNode;
    priceM2: ReactNode;
    fewSales: string;
  };
  className?: string;
};

/** Sales, median price and R$/m² (IPTU) per area band. */
export function AreaBandTable({
  caption,
  showCaption,
  rows,
  labels,
  className,
}: AreaBandTableProps) {
  return (
    <Table caption={caption} showCaption={showCaption} className={className}>
      <thead className="bg-canvas">
        <tr>
          <th scope="col" className={cn(th, 'text-left')}>
            {labels.band}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.sales}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.median}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.priceM2}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-b-0">
            <th scope="row" className={cn(td, 'text-left font-medium')}>
              {row.label}
            </th>
            <td className={cn(td, num)}>{row.sales}</td>
            <td className={cn(td, num)}>
              <Price value={row.medianValue} fewSales={labels.fewSales} />
            </td>
            <td className={cn(td, num)}>
              <Price value={row.medianPriceM2} fewSales={labels.fewSales} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// --- NeighborComparisonTable ----------------------------------------------------------------

export type NeighborComparisonRow = {
  key: string;
  name: ReactNode;
  href?: string;
  priceM2?: string | null;
  /** Signed text, e.g. "+1,8%". */
  change?: string | null;
  /** The page's own neighborhood: highlighted. */
  current?: boolean;
};

export type NeighborComparisonTableProps = {
  caption: string;
  showCaption?: boolean;
  rows: NeighborComparisonRow[];
  labels: {
    neighborhood: ReactNode;
    priceM2: ReactNode;
    change: ReactNode;
    /** Visually hidden suffix for the highlighted row, e.g. "(este bairro)". */
    current: string;
    fewSales: string;
  };
  className?: string;
};

export function NeighborComparisonTable({
  caption,
  showCaption,
  rows,
  labels,
  className,
}: NeighborComparisonTableProps) {
  return (
    <Table caption={caption} showCaption={showCaption} className={className}>
      <thead className="bg-canvas">
        <tr>
          <th scope="col" className={cn(th, 'text-left')}>
            {labels.neighborhood}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.priceM2}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.change}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            data-current={row.current ? 'true' : undefined}
            className={cn(
              'border-b border-line last:border-b-0',
              row.current && 'bg-action-subtle',
            )}
          >
            <th scope="row" className={cn(td, 'text-left')}>
              {row.current ? (
                <span className="font-semibold">
                  {row.name}
                  <span className="sr-only"> {labels.current}</span>
                </span>
              ) : (
                <Name href={row.href}>{row.name}</Name>
              )}
            </th>
            <td className={cn(td, num, row.current && 'font-semibold')}>
              <Price value={row.priceM2} fewSales={labels.fewSales} />
            </td>
            <td className={cn(td, num)}>{row.change ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// --- NeighborIncomeTable --------------------------------------------------------------------

export type NeighborIncomeRow = {
  key: string;
  name: ReactNode;
  href?: string;
  medianValue?: string | null;
  /** Indicated monthly income under the page's assumptions (a simulation). */
  income?: string | null;
  current?: boolean;
};

export type NeighborIncomeTableProps = {
  caption: string;
  showCaption?: boolean;
  rows: NeighborIncomeRow[];
  labels: {
    neighborhood: ReactNode;
    medianValue: ReactNode;
    income: ReactNode;
    current: string;
    fewSales: string;
  };
  /** The "Simulação · não é aprovação" badge: income figures are simulations. */
  badge: ReactNode;
  className?: string;
};

export function NeighborIncomeTable({
  caption,
  showCaption,
  rows,
  labels,
  badge,
  className,
}: NeighborIncomeTableProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div>{badge}</div>
      <Table caption={caption} showCaption={showCaption}>
        <thead className="bg-canvas">
          <tr>
            <th scope="col" className={cn(th, 'text-left')}>
              {labels.neighborhood}
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              {labels.medianValue}
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              {labels.income}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              data-current={row.current ? 'true' : undefined}
              className={cn(
                'border-b border-line last:border-b-0',
                row.current && 'bg-action-subtle',
              )}
            >
              <th scope="row" className={cn(td, 'text-left')}>
                {row.current ? (
                  <span className="font-semibold">
                    {row.name}
                    <span className="sr-only"> {labels.current}</span>
                  </span>
                ) : (
                  <Name href={row.href}>{row.name}</Name>
                )}
              </th>
              <td className={cn(td, num)}>
                <Price value={row.medianValue} fewSales={labels.fewSales} />
              </td>
              <td className={cn(td, num)}>{row.income ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

// --- BuildingTable (street page core) -------------------------------------------------------

export type BuildingTableRow = {
  key: string;
  /** Display name, already built ("Edifício nº 1.410" for unnamed buildings). */
  name: ReactNode;
  href?: string;
  year?: string | null;
  floors?: string | null;
  units?: string | null;
  /** Counts only, e.g. "12". */
  sales?: string | null;
};

export type BuildingTableProps = {
  caption: string;
  showCaption?: boolean;
  rows: BuildingTableRow[];
  labels: {
    building: ReactNode;
    year: ReactNode;
    floors: ReactNode;
    units: ReactNode;
    sales: ReactNode;
  };
  /** E.g. "Mostrando 7 de 38 · Ver todos". */
  footer?: ReactNode;
  className?: string;
};

/** Buildings of a street. On phones, year and floors collapse to keep 3 columns. */
export function BuildingTable({
  caption,
  showCaption,
  rows,
  labels,
  footer,
  className,
}: BuildingTableProps) {
  const wide = 'hidden md:table-cell';
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Table caption={caption} showCaption={showCaption}>
        <thead className="bg-canvas">
          <tr>
            <th scope="col" className={cn(th, 'text-left')}>
              {labels.building}
            </th>
            <th scope="col" className={cn(th, 'text-right', wide)}>
              {labels.year}
            </th>
            <th scope="col" className={cn(th, 'text-right', wide)}>
              {labels.floors}
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              {labels.units}
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              {labels.sales}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <th scope="row" className={cn(td, 'text-left')}>
                <Name href={row.href}>{row.name}</Name>
              </th>
              <td className={cn(td, num, wide)}>{row.year ?? '—'}</td>
              <td className={cn(td, num, wide)}>{row.floors ?? '—'}</td>
              <td className={cn(td, num)}>{row.units ?? '—'}</td>
              <td className={cn(td, num)}>{row.sales ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {footer ? <div className="type-body-s text-fg-muted">{footer}</div> : null}
    </div>
  );
}

// --- SegmentTable (long-street parent page) -------------------------------------------------

export type SegmentRow = {
  key: string;
  /** Neighborhood of the segment. */
  name: ReactNode;
  href?: string;
  buildings?: string | null;
  units?: string | null;
  sales?: string | null;
  current?: boolean;
};

export type SegmentTableProps = {
  caption: string;
  showCaption?: boolean;
  rows: SegmentRow[];
  labels: {
    segment: ReactNode;
    buildings: ReactNode;
    units: ReactNode;
    sales: ReactNode;
    current: string;
  };
  className?: string;
};

export function SegmentTable({ caption, showCaption, rows, labels, className }: SegmentTableProps) {
  return (
    <Table caption={caption} showCaption={showCaption} className={className}>
      <thead className="bg-canvas">
        <tr>
          <th scope="col" className={cn(th, 'text-left')}>
            {labels.segment}
          </th>
          <th scope="col" className={cn(th, 'hidden text-right md:table-cell')}>
            {labels.buildings}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.units}
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            {labels.sales}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            data-current={row.current ? 'true' : undefined}
            className={cn(
              'border-b border-line last:border-b-0',
              row.current && 'bg-action-subtle',
            )}
          >
            <th scope="row" className={cn(td, 'text-left')}>
              {row.current ? (
                <span className="font-semibold">
                  {row.name}
                  <span className="sr-only"> {labels.current}</span>
                </span>
              ) : (
                <Name href={row.href}>{row.name}</Name>
              )}
            </th>
            <td className={cn(td, num, 'hidden md:table-cell')}>{row.buildings ?? '—'}</td>
            <td className={cn(td, num)}>{row.units ?? '—'}</td>
            <td className={cn(td, num)}>{row.sales ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
