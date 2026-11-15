import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { InvestorsScreen } from '@/screens/marketplace/InvestorsScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('investors.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/investidores' },
    openGraph: { title: t('title'), description: t('description') },
  };
}

/** Mockup 58. */
export default function Page() {
  return <InvestorsScreen />;
}
