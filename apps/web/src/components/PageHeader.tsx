'use client';

import { cn } from '@casvitta/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DemoBadge } from './badges';

type Props = {
  /** Breadcrumb items, e.g. ["Leads", "Funil"]. */
  breadcrumb?: ReactNode[];
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Shorter title for the phone top bar (defaults to title). */
  mobileTitle?: ReactNode;
  /** Back link on the phone top bar (detail screens). */
  mobileBack?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shows the "Demonstrativo" badge (any screen with demo data). */
  demo?: boolean;
  /** Hide the desktop block on phones (screens with their own mobile layout). */
  className?: string;
};

/**
 * Broker OS page header (mockups 30–35) and, on phones, the sticky top bar of mockups 21/36/37:
 * back arrow, title, "Demonstrativo".
 */
export function PageHeader({
  breadcrumb,
  eyebrow,
  title,
  mobileTitle,
  mobileBack,
  subtitle,
  actions,
  demo,
  className,
}: Props) {
  const t = useTranslations('common');
  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 flex h-14 items-center gap-2 border-b border-line bg-panel px-4 md:hidden">
        {mobileBack ? (
          <Link
            href={mobileBack}
            aria-label={t('back')}
            className="-ml-2 flex size-11 items-center justify-center rounded-control"
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.6} className="size-5" />
          </Link>
        ) : null}
        <h1 className="min-w-0 flex-1 truncate type-title text-[18px]">{mobileTitle ?? title}</h1>
        {demo ? <DemoBadge /> : null}
      </div>
      <header className={cn('hidden flex-col gap-1 md:flex', className)}>
        {breadcrumb?.length ? (
          <p className="type-body-s text-fg-muted">
            {breadcrumb.map((item, i) => (
              <span key={i}>
                {i > 0 ? <span aria-hidden="true">{' › '}</span> : null}
                {item}
              </span>
            ))}
          </p>
        ) : null}
        {eyebrow ? <p className="type-body-s text-fg-muted">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="type-display-l">{title}</h1>
            {subtitle ? <p className="max-w-[72ch] type-body text-fg-strong">{subtitle}</p> : null}
          </div>
          {actions || demo ? (
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              {demo ? <DemoBadge /> : null}
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}
