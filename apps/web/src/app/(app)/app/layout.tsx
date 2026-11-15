import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { BottomTabs } from '@/components/app-shell/BottomTabs';
import { SideNav } from '@/components/app-shell/SideNav';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Broker OS shell, served on app.casvitta.com.br (see src/proxy.ts). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-panel px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('common.skipToContent')}
      </a>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="content" className="flex-1 px-4 pb-24 md:px-8 md:pt-6 md:pb-10 lg:pt-8">
          <div className="mx-auto max-w-(--layout-content)">{children}</div>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
