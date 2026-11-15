import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AdsStepProperty } from '@/screens/ads/AdsFlow';

export async function generateMetadata() {
  const t = await getTranslations('ads');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <AdsStepProperty />
    </Suspense>
  );
}
