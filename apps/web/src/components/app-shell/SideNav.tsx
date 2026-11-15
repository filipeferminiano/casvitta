'use client';

import Link from 'next/link';
import { cn, Logo, LogoMark } from '@casvitta/ui';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { footerNav, hrefFor, moduleNav, primaryNav, type NavItem } from './nav-items';

/**
 * Desktop side navigation: 264px from 1024px up, a 72px icon rail between 768px and 1024px,
 * hidden on phones (BottomTabs takes over).
 */
export function SideNav() {
  const t = useTranslations('nav');
  const active = useSelectedLayoutSegment();

  const renderItem = (item: NavItem) => {
    const current = item.segment === active;
    const Icon = item.icon;
    return (
      <li key={item.segment}>
        <Link
          href={hrefFor(item)}
          aria-current={current ? 'page' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-control px-3 type-body-s font-medium text-fg-strong',
            'justify-center lg:justify-start',
            'hover:bg-subtle hover:text-fg',
            current && 'bg-action-subtle text-action-hover hover:bg-action-subtle',
          )}
        >
          <Icon aria-hidden="true" strokeWidth={1.6} className="size-5 shrink-0" />
          <span className="sr-only lg:not-sr-only">{t(item.labelKey)}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-line bg-panel md:flex lg:w-(--layout-side-nav)">
      <div className="flex h-16 items-center justify-center px-4 lg:justify-start lg:px-6">
        <Link href={hrefFor(primaryNav[0]!)} aria-label={t('home')} className="rounded-control">
          <Logo height={24} title={null} className="hidden lg:block" />
          <LogoMark size={28} title={null} className="lg:hidden" />
        </Link>
      </div>
      <nav aria-label={t('label')} className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-1">{primaryNav.map(renderItem)}</ul>
        <div className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 type-eyebrow">
            <span className="sr-only lg:not-sr-only">{t('modulesGroup')}</span>
          </h2>
          <ul className="flex flex-col gap-1">{moduleNav.map(renderItem)}</ul>
        </div>
        <ul className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
          {footerNav.map(renderItem)}
        </ul>
      </nav>
    </aside>
  );
}
