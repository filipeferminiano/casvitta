import { Logo, LogoMark } from '@casvitta/ui';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { MarketplaceNav } from '@/screens/marketplace/MarketplaceNav';

/** Public consumer site on casvitta.com.br. Mobile-first (mockups 13, 24–26). */
export default async function MarketplaceLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-panel px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('common.skipToContent')}
      </a>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:h-[68px] md:px-8 xl:px-20">
          <Link
            href="/"
            aria-label={t('common.homeLink')}
            className="flex shrink-0 items-center gap-3 rounded-control"
          >
            <span className="hidden size-8 items-center justify-center rounded-control bg-fg md:flex">
              <LogoMark tone="white" size={22} title={null} />
            </span>
            <Logo height={18} title={null} />
          </Link>
          <MarketplaceNav />
          <form action="/comprar" role="search" className="relative hidden flex-1 lg:block">
            <label htmlFor="market-search" className="sr-only">
              {t('marketplace.search.label')}
            </label>
            <Search
              aria-hidden="true"
              strokeWidth={1.6}
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            />
            <input
              id="market-search"
              name="q"
              placeholder={t('marketplace.search.example')}
              className="h-11 w-full rounded-control border border-line bg-panel pr-3 pl-9 type-body-s placeholder:text-fg-strong focus-visible:outline-2 focus-visible:outline-focus"
            />
          </form>
          <Link
            href="/entrar"
            className="ml-auto shrink-0 type-body-s font-semibold text-action underline underline-offset-2 lg:ml-0"
          >
            {t('marketplace.nav.signIn')}
          </Link>
        </div>
      </header>
      <main id="content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line bg-panel">
        <p className="mx-auto max-w-7xl px-4 py-6 type-caption md:px-8 xl:px-20">
          {t('marketplace.footer')}
        </p>
      </footer>
    </div>
  );
}
