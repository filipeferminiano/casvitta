import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { PricesScreen } from '@/screens/audience/PricesScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('audience.prices.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/precos',
    absoluteTitle: true,
  });
}

/** Mockup landing-pages/00-prices-hypotheses: every plan's features and limits. */
export default function Page() {
  return <PricesScreen />;
}
