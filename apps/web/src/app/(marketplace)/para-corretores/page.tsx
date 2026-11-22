import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { limitOf } from '@/config/catalog';
import { publicMetadata } from '@/lib/metadata';
import { BrokersScreen } from '@/screens/audience/BrokersScreen';
import { cheapestPaid, planPrice } from '@/screens/audience/plans';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('audience.brokers.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description', {
      count: limitOf('free', 'active_properties') ?? 0,
      price: planPrice(cheapestPaid()),
    }),
    path: '/para-corretores',
    absoluteTitle: true,
  });
}

/** Mockup landing-pages/02-brokers (CRM release): page, CRM, automations, visit assistant. */
export default function Page() {
  return <BrokersScreen />;
}
