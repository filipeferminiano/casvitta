import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AdsIndexScreen } from '@/screens/ads/AdsScreens';

export async function generateMetadata() {
  const t = await getTranslations('ads');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <AdsIndexScreen />
    </Suspense>
  );
}
