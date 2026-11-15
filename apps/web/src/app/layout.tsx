import { color } from '@casvitta/config/tokens';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { SITE_URL } from '@/config/site';
import { OG_IMAGE } from '@/lib/metadata';

import { familjenGrotesk, ibmPlexMono, ibmPlexSans } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    metadataBase: new URL(SITE_URL),
    openGraph: { siteName: 'Casvitta', locale: 'pt_BR', type: 'website', images: [OG_IMAGE] },
    title: { default: t('title'), template: t('titleTemplate', { page: '%s' }) },
    description: t('description'),
  };
}

export const viewport: Viewport = { themeColor: color['ink-900'] };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${familjenGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-dvh bg-canvas text-fg">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
