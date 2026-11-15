import type { Key, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Numbers: right-aligned, mono, tabular. */
  numeric?: boolean;
  /** Content for the totals row, if any. */
  total?: ReactNode;
  className?: string;
};

export type DataTableProps<Row> = {
  /** Accessible table caption (visually hidden unless `showCaption`). */
  caption: ReactNode;
  showCaption?: boolean;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => Key;
  /** Render a totals row with a 2px ink top border. */
  showTotals?: boolean;
  /** Shown instead of the body when there are no rows (use EmptyState). */
  empty?: ReactNode;
  className?: string;
};

export function DataTable<Row>({
  caption,
  showCaption = false,
  columns,
  rows,
  rowKey,
  showTotals = false,
  empty,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const align = (column: DataTableColumn<Row>) =>
    column.numeric ? 'text-right font-mono tabular' : 'text-left';

  return (
    // Horizontal scroll stays inside the container on small screens.
    <div
      className={cn('overflow-x-auto rounded-card border border-line bg-panel', className)}
      role="region"
      aria-label={typeof caption === 'string' ? caption : undefined}
      tabIndex={0}
    >
      <table className="w-full border-collapse type-body-s">
        <caption className={cn(showCaption ? 'p-4 text-left type-title' : 'sr-only')}>
          {caption}
        </caption>
        <thead className="bg-canvas">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'border-b border-line px-4 py-2.5 type-caption font-medium whitespace-nowrap',
                  column.numeric ? 'text-right' : 'text-left',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-4 py-3 text-fg', align(column), column.className)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {showTotals ? (
          <tfoot>
            <tr className="border-t-2 border-fg font-semibold">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-4 py-3 text-fg', align(column), column.className)}
                >
                  {column.total}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
