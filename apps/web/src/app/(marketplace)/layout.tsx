import Link from 'next/link';
import { Logo } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

/** Public consumer site on casvitta.com.br. Mobile-first. */
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
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 md:px-8">
          <Link href="/" aria-label={t('common.homeLink')} className="rounded-control">
            <Logo height={24} title={null} />
          </Link>
        </div>
      </header>
      <main id="content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line bg-panel">
        <p className="mx-auto max-w-6xl px-4 py-6 type-caption md:px-8">
          {t('marketplace.footer')}
        </p>
      </footer>
    </div>
  );
}
