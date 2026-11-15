import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OwnerListingScreen } from '@/screens/marketplace/OwnerListingScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('owner.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/anunciar-imovel' },
    openGraph: { title: t('title'), description: t('description') },
  };
}

/** Mockup 56. */
export default function Page() {
  return <OwnerListingScreen />;
}
