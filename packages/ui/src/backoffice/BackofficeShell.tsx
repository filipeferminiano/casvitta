import type { ComponentType, ElementType, ReactNode } from 'react';

import { cn } from '../lib/cn.ts';
import { LogoMark } from '../components/Logo.tsx';

export type BackofficeNavItem = {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  current?: boolean;
  /** Queue size. "attention" (yellow) when something waits for the team. Hidden when 0/absent. */
  count?: number;
  countTone?: 'attention' | 'neutral';
  /** Accessible text for the count, e.g. "12 pendentes". */
  countLabel?: string;
};

export type BackofficeNavGroup = { key: string; label?: string; items: BackofficeNavItem[] };

export type BackofficeShellProps = {
  brand: string; // "CASVITTA"
  badge: string; // "BACKOFFICE"
  homeHref: string;
  homeLabel: string;
  navLabel: string;
  groups: BackofficeNavGroup[];
  /** Top bar: global search. */
  search?: ReactNode;
  /** Top bar, right: environment badge(s). */
  badges?: ReactNode;
  /** Sidebar footer: who is signed in and the "everything is logged" note. */
  footer?: ReactNode;
  skipLabel: string;
  /** Link component (next/link in the app). */
  linkAs?: ElementType;
  children: ReactNode;
};

/**
 * Backoffice frame (docs/mockups/backoffice): dark ink sidebar with the BACKOFFICE badge, grouped
 * navigation with queue counts, a top bar with search and the environment badge.
 */
export function BackofficeShell({
  brand,
  badge,
  homeHref,
  homeLabel,
  navLabel,
  groups,
  search,
  badges,
  footer,
  skipLabel,
  linkAs: Link = 'a',
  children,
}: BackofficeShellProps) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-panel px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {skipLabel}
      </a>
      {/* The ink column runs the full page height; its content stays in view while scrolling. */}
      <div className="w-[237px] shrink-0 bg-ink-900">
        <aside className="sticky top-0 flex h-dvh flex-col text-white">
          <div className="mx-3 flex h-[58px] items-center gap-2 border-b border-ink-700 px-2">
            <Link
              href={homeHref}
              aria-label={homeLabel}
              className="flex items-center gap-2 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <LogoMark tone="white" size={20} title={null} />
              <span className="text-[15px] font-bold tracking-[0.02em]">{brand}</span>
            </Link>
            <span className="ml-auto rounded-chip bg-attention px-1.5 py-0.5 font-mono text-[10px] leading-4 tracking-[0.06em] text-fg">
              {badge}
            </span>
          </div>
          <nav
            aria-label={navLabel}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3"
          >
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-0.5">
                {group.label ? (
                  <h2 className="px-3 pt-2 pb-1 type-eyebrow text-ink-300">{group.label}</h2>
                ) : null}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={item.current ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-control px-3 py-1.5 text-[15px] leading-5 font-medium text-white',
                          'hover:bg-ink-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white',
                          item.current && 'bg-ink-700',
                        )}
                      >
                        <item.icon aria-hidden strokeWidth={1.6} className="size-4.5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.count ? (
                          <span
                            className={cn(
                              'min-w-6 rounded-pill px-1.5 text-center font-mono text-[11px] leading-5 font-semibold tabular',
                              item.countTone === 'attention'
                                ? 'bg-attention text-fg'
                                : 'bg-ink-700 text-white',
                            )}
                          >
                            <span aria-hidden="true">{item.count}</span>
                            <span className="sr-only">{item.countLabel ?? item.count}</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          {footer ? (
            <div className="mx-3 border-t border-ink-700 px-2 py-4 type-body-s text-ink-200">
              {footer}
            </div>
          ) : null}
        </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[67px] items-center gap-4 border-b border-line bg-panel px-8">
          <div className="max-w-[586px] flex-1">{search}</div>
          <div className="ml-auto flex items-center gap-2">{badges}</div>
        </header>
        <main id="content" className="flex-1 px-8 pt-8 pb-12">
          <div className="mx-auto max-w-[1140px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export type EnvironmentBadgeProps = {
  environment: 'production' | 'staging' | 'development';
  label: string;
};

/** PRODUÇÃO in red (be careful: real data), STAGING in yellow, development in grey. */
export function EnvironmentBadge({ environment, label }: EnvironmentBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-chip px-2 py-0.5 font-mono text-[11px] leading-4 font-semibold tracking-[0.04em] uppercase',
        environment === 'production' && 'bg-danger-subtle text-danger',
        environment === 'staging' && 'bg-attention-subtle text-attention-fg',
        environment === 'development' && 'bg-subtle text-fg-muted',
      )}
    >
      {label}
    </span>
  );
}

export type BackofficePageHeaderProps = {
  /** "Sexta, 20 de novembro". */
  date?: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
};

export function BackofficePageHeader({
  date,
  title,
  description,
  aside,
}: BackofficePageHeaderProps) {
  return (
    <header className="mb-6 flex items-end justify-between gap-6">
      <div className="max-w-[700px]">
        {date ? <p className="type-body-s text-fg-muted">{date}</p> : null}
        <h1 className="mt-1 type-display-l">{title}</h1>
        {description ? <p className="mt-1 type-body text-fg-muted">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}
