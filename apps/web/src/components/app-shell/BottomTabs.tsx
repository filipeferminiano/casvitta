'use client';

import Link from 'next/link';
import { cn } from '@casvitta/ui';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { bottomTabs, hrefFor } from './nav-items';

/** Phone navigation: Início, Leads, Conversas, Agenda, Anúncios. */
export function BottomTabs() {
  const t = useTranslations('nav');
  const active = useSelectedLayoutSegment();

  return (
    <nav
      aria-label={t('mobileLabel')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {bottomTabs.map((item) => {
          const current = item.segment === active;
          const Icon = item.icon;
          return (
            <li key={item.segment}>
              <Link
                href={hrefFor(item)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-4 font-medium text-fg-muted',
                  current && 'text-action',
                )}
              >
                <Icon aria-hidden="true" strokeWidth={1.6} className="size-6" />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
