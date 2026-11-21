import { TooltipProvider } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { getCityIndex } from '@/lib/data/market';
import { buildMenus, NAV_CITY, navHoods } from '@/lib/site-nav';
import { MarketplaceHeader } from '@/screens/marketplace/MarketplaceNav';
import { SiteFooter } from '@/screens/marketplace/SiteFooter';
import { SiteJsonLd } from '@/screens/marketplace/SiteJsonLd';

/** Public site at casvitta.com.br (mockups 13, 24–26, 51–61). Mobile-first. */
export default async function MarketplaceLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  // Menus list only neighborhoods with published data; without data they still show the tools.
  const hoods = navHoods(await getCityIndex(NAV_CITY).catch(() => null));
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteJsonLd />
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-panel px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('common.skipToContent')}
      </a>
      <MarketplaceHeader menus={buildMenus(hoods)} />
      <main id="content" className="flex-1">
        <TooltipProvider>{children}</TooltipProvider>
      </main>
      <SiteFooter />
    </div>
  );
}
