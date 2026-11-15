import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { DevelopersScreen } from '@/screens/marketplace/DevelopersScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('developers.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/incorporadoras',
  });
}

/** Mockup 57. */
export default function Page() {
  return <DevelopersScreen />;
}
