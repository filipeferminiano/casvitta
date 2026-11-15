import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ForBrokersScreen } from '@/screens/marketplace/ForBrokersScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forBrokers.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/para-corretores' },
    openGraph: { title: t('title'), description: t('description') },
  };
}

/** Mockup 54. */
export default function Page() {
  return <ForBrokersScreen />;
}
