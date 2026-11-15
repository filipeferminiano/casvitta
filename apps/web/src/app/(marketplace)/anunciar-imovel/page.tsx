import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { OwnerListingScreen } from '@/screens/marketplace/OwnerListingScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('owner.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/anunciar-imovel',
  });
}

/** Mockup 56. */
export default function Page() {
  return <OwnerListingScreen />;
}
