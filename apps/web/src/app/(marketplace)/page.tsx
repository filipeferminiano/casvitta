import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HomeScreen } from '@/screens/marketplace/HomeScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home.meta');
  return {
    title: { absolute: t('title') },
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default function MarketplaceHome() {
  return <HomeScreen />;
}
