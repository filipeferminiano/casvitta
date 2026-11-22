import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { isLive } from '@/lib/live';
import { OnboardingScreen } from '@/screens/social/OnboardingScreen';

export async function generateMetadata() {
  const t = await getTranslations('social.onboarding');
  return { title: t('metaTitle') };
}

/** SW1 · Onboarding to the first publication (docs/mockups/social/10). */
export default function Page() {
  if (!isLive('social')) notFound();
  return (
    <Suspense>
      <OnboardingScreen />
    </Suspense>
  );
}
