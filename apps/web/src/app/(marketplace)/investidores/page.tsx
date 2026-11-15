import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { InvestorsScreen } from '@/screens/marketplace/InvestorsScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('investors.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/investidores',
  });
}

/** Mockup 58. */
export default function Page() {
  return <InvestorsScreen />;
}
