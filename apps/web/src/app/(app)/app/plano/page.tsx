import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { isLive } from '@/lib/live';
import { PlanScreen } from '@/screens/account/PlanScreen';

export async function generateMetadata() {
  const t = await getTranslations('planUsage');
  return { title: t('title') };
}

/** Plano e uso: plan, meters and payment (Stripe when billing is on). Live API only. */
export default function Page() {
  if (!isLive('accounts')) notFound();
  return (
    <Suspense>
      <PlanScreen />
    </Suspense>
  );
}
