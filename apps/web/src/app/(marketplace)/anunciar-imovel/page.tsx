import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { OwnersScreen } from '@/screens/audience/OwnersScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('audience.owners.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/anunciar-imovel',
    absoluteTitle: true,
  });
}

/** Mockup landing-pages/01: owners, one-off listing for 30 or 90 days. */
export default function Page() {
  return <OwnersScreen />;
}
