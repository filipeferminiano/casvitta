'use client';

import { cn, LogoMark } from '@casvitta/ui';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useHome } from '@/lib/data/crm';
import { useBroker, useNavCounts } from '@/lib/data/hooks';
import { isLive } from '@/lib/live';

import { footerNav, hrefFor, moduleNav, primaryNav, type NavItem } from './nav-items';
import { SignOutButton } from './SignOutButton';

/**
 * Desktop side navigation (mockups 04, 30): profile header, "Núcleo" (six fixed items),
 * "Módulos" (activated modules), then store and settings. 264px from 1024px, 72px icon rail
 * between 768px and 1024px, hidden on phones (BottomTabs).
 */
export function SideNav() {
  const t = useTranslations('nav');
  const active = useSelectedLayoutSegment();
  const broker = useBroker().data;
  const crm = isLive('crm');
  const counts = useNavCounts().data;
  // Live CRM: unread messages from the API, never the demo store's counters.
  const unread = useLiveUnread(crm);

  const countFor = (item: NavItem) =>
    crm
      ? item.segment === 'conversas'
        ? unread
        : 0
      : item.segment === 'leads'
        ? counts?.leads
        : item.segment === 'conversas'
          ? counts?.conversations
          : 0;

  const renderItem = (item: NavItem) => {
    const current = item.segment === active;
    const Icon = item.icon;
    const count = countFor(item) ?? 0;
    return (
      <li key={item.segment}>
        <Link
          href={hrefFor(item)}
          aria-current={current ? 'page' : undefined}
          className={cn(
            'relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] leading-5 font-medium text-fg-strong',
            'justify-center lg:justify-start',
            'hover:bg-subtle hover:text-fg',
            current && 'bg-action-subtle text-action-hover hover:bg-action-subtle',
          )}
        >
          <Icon aria-hidden="true" strokeWidth={1.6} className="size-5 shrink-0" />
          <span className="sr-only lg:not-sr-only lg:flex-1">{t(item.labelKey)}</span>
          {count > 0 ? (
            <span className="absolute top-1.5 right-1.5 min-w-5 rounded-pill bg-action px-1.5 text-center font-mono text-[11px] leading-5 font-semibold text-fg-on-action lg:static">
              <span aria-hidden="true">{count}</span>
              <span className="sr-only">{t('countLabel', { count })}</span>
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-line bg-panel md:flex lg:w-(--layout-side-nav)">
      <div className="mx-3 flex h-[68px] items-center gap-3 border-b border-line lg:px-2">
        <Link
          href={hrefFor(primaryNav[0]!)}
          aria-label={t('home')}
          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fg max-lg:mx-auto"
        >
          <LogoMark tone="white" size={22} title={null} />
        </Link>
        {broker ? (
          <div className="hidden min-w-0 flex-col lg:flex">
            <span className="truncate type-body-s font-semibold text-fg">{broker.displayName}</span>
            <span className="truncate type-caption">{broker.roleLabel}</span>
          </div>
        ) : null}
      </div>
      <nav aria-label={t('label')} className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 type-eyebrow">
            <span className="sr-only lg:not-sr-only">
              {t(crm ? 'attendanceGroup' : 'coreGroup')}
            </span>
          </h2>
          <ul className="flex flex-col">{primaryNav.map(renderItem)}</ul>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 type-eyebrow">
            <span className="sr-only lg:not-sr-only">{t('modulesGroup')}</span>
          </h2>
          <ul className="flex flex-col">{moduleNav.map(renderItem)}</ul>
        </div>
        <ul className="flex flex-col border-t border-line pt-4">{footerNav.map(renderItem)}</ul>
        <SignOutButton compact />
      </nav>
    </aside>
  );
}

function useLiveUnread(enabled: boolean): number {
  const home = useHome(enabled);
  return home.data?.today.unread ?? 0;
}
