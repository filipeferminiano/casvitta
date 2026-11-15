import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';

export type PanelProps = Omit<ComponentProps<'section'>, 'title'> & {
  title?: ReactNode;
  /** Right side of the header: a count, a link or a status pill. */
  aside?: ReactNode;
  /** Heading level for the title (default h2). */
  as?: 'h2' | 'h3';
  /** Remove body padding (lists that draw their own rows). */
  flush?: boolean;
  /** Dashed border, used for "Em breve" content. */
  dashed?: boolean;
};

/** Card container used across Broker OS screens: optional header, 1px border, radius 10. */
export function Panel({
  title,
  aside,
  as: Heading = 'h2',
  flush = false,
  dashed = false,
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-card border bg-panel',
        dashed ? 'border-dashed border-line-dashed' : 'border-line',
        className,
      )}
      {...props}
    >
      {title || aside ? (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          {title ? (
            <Heading className="type-title text-[20px] leading-7">{title}</Heading>
          ) : (
            <span />
          )}
          {aside ? <div className="shrink-0 pt-1">{aside}</div> : null}
        </header>
      ) : null}
      <div className={cn(!flush && 'px-5 pb-5', !title && !aside && !flush && 'pt-5')}>
        {children}
      </div>
    </section>
  );
}

/** Rows separated by 1px rules, inside a Panel. */
export function PanelList({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('divide-y divide-line border-t border-line', className)} {...props} />;
}
