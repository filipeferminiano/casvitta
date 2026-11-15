import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { ForBrokersScreen } from '@/screens/marketplace/ForBrokersScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forBrokers.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/para-corretores',
  });
}

/** Mockup 54. */
export default function Page() {
  return <ForBrokersScreen />;
}
