import { cn } from '../lib/cn.ts';

export type MonthlyPoint = {
  /** 'YYYY-MM'. */
  month: string;
  /** Median already rounded for publication (e.g. R$/m²); null when the month is below the threshold. */
  value: number | null;
  count: number;
};

export type MonthlySeriesChartProps = {
  points: MonthlyPoint[];
  formatValue: (value: number) => string;
  /** Month label for the accessible table, e.g. "jan/2026". */
  formatMonth: (month: string) => string;
  /** Accessible name and visible caption. */
  title: string;
  /** Visible explanation under the chart (what the line and bars mean). */
  description?: string;
  /** Legend and table header for the bars, e.g. "Vendas no mês". */
  countLabel: string;
  /** Legend and table header for the line, e.g. "Mediana R$/m²". */
  valueLabel: string;
  /** Table header for the month column, e.g. "Mês". */
  monthLabel: string;
  className?: string;
};

const W = 640;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 72 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/**
 * Monthly median line over monthly sales bars. Pure SVG rendered on the server (no client JS);
 * a visually hidden table carries the same data for screen readers.
 */
export function MonthlySeriesChart({
  points,
  formatValue,
  formatMonth,
  title,
  description,
  countLabel,
  valueLabel,
  monthLabel,
  className,
}: MonthlySeriesChartProps) {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const hasData = points.length > 0;
  const maxCount = Math.max(1, ...points.map((p) => p.count));
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const span = maxValue - minValue || Math.max(1, maxValue * 0.1);
  const lo = minValue - span * 0.1;
  const hi = maxValue + span * 0.1;

  const step = points.length ? PLOT_W / points.length : 0;
  const x = (i: number) => PAD.left + step * i + step / 2;
  const yValue = (v: number) => PAD.top + PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H;
  const barHeight = (count: number) => (count / maxCount) * PLOT_H * 0.45;

  let path = '';
  let penDown = false;
  points.forEach((p, i) => {
    if (p.value === null) {
      penDown = false;
      return;
    }
    path += `${penDown ? 'L' : 'M'}${x(i).toFixed(1)},${yValue(p.value).toFixed(1)}`;
    penDown = true;
  });
  const isolated = points.flatMap((p, i) =>
    p.value !== null && points[i - 1]?.value == null && points[i + 1]?.value == null
      ? [{ i, value: p.value }]
      : [],
  );

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      {hasData ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={title}
          className="h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            className="stroke-line"
            strokeWidth={1}
          />
          {points.map((p, i) => (
            <rect
              key={p.month}
              x={x(i) - Math.max(1, step * 0.35)}
              width={Math.max(2, step * 0.7)}
              y={PAD.top + PLOT_H - barHeight(p.count)}
              height={barHeight(p.count)}
              className="fill-ink-200"
            />
          ))}
          {values.length ? (
            <>
              <text
                x={PAD.left - 8}
                y={yValue(maxValue) + 4}
                textAnchor="end"
                className="fill-fg-muted font-mono text-[12px]"
              >
                {formatValue(maxValue)}
              </text>
              <text
                x={PAD.left - 8}
                y={yValue(minValue) + 4}
                textAnchor="end"
                className="fill-fg-muted font-mono text-[12px]"
              >
                {formatValue(minValue)}
              </text>
            </>
          ) : null}
          <path d={path} fill="none" className="stroke-action" strokeWidth={2} />
          {isolated.map(({ i, value }) => (
            <circle key={i} cx={x(i)} cy={yValue(value)} r={2.5} className="fill-action" />
          ))}
          {points.map((p, i) =>
            i === 0 || p.month.endsWith('-01') ? (
              <text
                key={`label-${p.month}`}
                x={x(i)}
                y={H - 8}
                textAnchor={i === 0 ? 'start' : 'middle'}
                className="fill-fg-muted font-mono text-[12px]"
              >
                {p.month.slice(0, 4)}
              </text>
            ) : null,
          )}
        </svg>
      ) : null}
      <figcaption className="flex flex-col gap-1">
        <span className="type-body-s font-medium text-fg">{title}</span>
        {hasData ? (
          <span className="flex flex-wrap gap-x-4 gap-y-1 type-caption" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-action" />
              {valueLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-3 bg-ink-200" />
              {countLabel}
            </span>
          </span>
        ) : null}
        {description ? <span className="type-caption">{description}</span> : null}
      </figcaption>
      {hasData ? (
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{monthLabel}</th>
              <th scope="col">{valueLabel}</th>
              <th scope="col">{countLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month}>
                <th scope="row">{formatMonth(p.month)}</th>
                <td>{p.value === null ? '—' : formatValue(p.value)}</td>
                <td>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
}
