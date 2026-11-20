import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { SignInScreen } from '@/screens/signup/SignInScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signIn');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
