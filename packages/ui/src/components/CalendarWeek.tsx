import type { ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type CalendarItemState =
  'confirmed' | 'awaiting' | 'free' | 'blocked' | 'task' | 'done' | 'selected';

export type CalendarItem = {
  id: string;
  /** Day key matching one of `days`. */
  day: string;
  /** Row key matching one of `rows` (e.g. "10h", "11h30"). */
  row: string;
  state: CalendarItemState;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional link (opens the visit). */
  href?: string;
};

export type CalendarWeekProps = {
  /** Accessible name for the grid ("Semana de 16 a 20 de novembro"). */
  label: string;
  days: { key: string; label: ReactNode; isToday?: boolean }[];
  rows: { key: string; label: ReactNode }[];
  items: CalendarItem[];
  className?: string;
  renderLink?: (href: string, className: string, children: ReactNode) => ReactNode;
};

/** DESIGN_SYSTEM §6 states. Text always says the state too; color only reinforces it. */
export const calendarStateClasses: Record<CalendarItemState, string> = {
  confirmed: 'border-l-4 border-l-action bg-action-subtle text-fg',
  awaiting:
    'border border-attention-line border-l-4 border-l-attention bg-attention-subtle text-fg',
  free: 'border border-dashed border-line-dashed bg-panel text-fg-strong',
  blocked: 'hatch border border-line text-fg-muted',
  task: 'bg-subtle text-fg',
  done: 'bg-subtle text-fg-strong',
  selected: 'bg-action text-white',
};

/** Day columns × time rows (only the rows that have something). */
export function CalendarWeek({
  label,
  days,
  rows,
  items,
  className,
  renderLink,
}: CalendarWeekProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table
        className="w-full min-w-[560px] table-fixed border-separate border-spacing-1.5"
        aria-label={label}
      >
        <thead>
          <tr>
            <th scope="col" className="w-14">
              <span className="sr-only">{label}</span>
            </th>
            {days.map((day) => (
              <th
                key={day.key}
                scope="col"
                aria-current={day.isToday ? 'date' : undefined}
                className={cn(
                  'px-2 pb-2 text-left type-body-s font-semibold',
                  day.isToday ? 'text-action' : 'text-fg',
                )}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th
                scope="row"
                className="h-[74px] align-top pt-2 text-left font-mono type-caption font-normal tabular"
              >
                {row.label}
              </th>
              {days.map((day) => {
                const cell = items.filter((i) => i.day === day.key && i.row === row.key);
                return (
                  <td key={day.key} className="h-[74px] align-top">
                    {cell.map((item) => {
                      const classes = cn(
                        'flex h-full min-h-[70px] flex-col gap-0.5 rounded-control px-2.5 py-2 text-[13px] leading-[18px]',
                        calendarStateClasses[item.state],
                        item.href &&
                          'hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-focus',
                      );
                      const content = (
                        <>
                          <span className="font-semibold">{item.title}</span>
                          {item.subtitle ? (
                            <span
                              className={
                                item.state === 'selected' ? 'text-white/90' : 'text-fg-strong'
                              }
                            >
                              {item.subtitle}
                            </span>
                          ) : null}
                        </>
                      );
                      return item.href && renderLink ? (
                        <div key={item.id} className="h-full">
                          {renderLink(item.href, classes, content)}
                        </div>
                      ) : (
                        <div key={item.id} className={classes}>
                          {content}
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
