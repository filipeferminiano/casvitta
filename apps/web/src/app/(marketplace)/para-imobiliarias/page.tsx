import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { AgenciesScreen } from '@/screens/audience/AgenciesScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('audience.agencies.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/para-imobiliarias',
    absoluteTitle: true,
  });
}

/** Mockup landing-pages/03: agencies, team plans and the demo form. */
export default function Page() {
  return <AgenciesScreen />;
}
