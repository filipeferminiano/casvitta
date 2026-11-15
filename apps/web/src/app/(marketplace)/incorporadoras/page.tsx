import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DevelopersScreen } from '@/screens/marketplace/DevelopersScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('developers.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/incorporadoras' },
    openGraph: { title: t('title'), description: t('description') },
  };
}

/** Mockup 57. */
export default function Page() {
  return <DevelopersScreen />;
}
