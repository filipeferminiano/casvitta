import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OFFERS } from '@/config/site';
import { formatBRL } from '@/lib/format';
import { publicMetadata } from '@/lib/metadata';
import { BrokersScreen } from '@/screens/audience/BrokersScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('audience.brokers.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description', {
      price: formatBRL(OFFERS.brokerPlan.priceCents),
      max: OFFERS.brokerPlan.maxActiveProperties,
    }),
    path: '/para-corretores',
    absoluteTitle: true,
  });
}

/** Mockup landing-pages/02: independent brokers, software with portal publishing included. */
export default function Page() {
  return <BrokersScreen />;
}
