import { LogoMark } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Broker and property landing pages, served on {brokerSlug}.casvitta.com.br (see src/proxy.ts).
 * Pages are generated from existing records, never edited as free HTML.
 */
export default async function LandingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('landing');
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-5 type-caption">
          <LogoMark size={16} title={null} />
          {t('poweredBy')}
        </div>
      </footer>
    </div>
  );
}
