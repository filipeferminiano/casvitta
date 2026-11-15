import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import type { SignupStep } from '@/domain/types';
import { SIGNUP_STEPS } from '@/lib/data/signup';
import { SignupScreen } from '@/screens/signup/SignupScreen';

type Props = { params: Promise<{ step: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signup');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { step } = await params;
  if (!SIGNUP_STEPS.includes(step as SignupStep)) notFound();
  return (
    <Suspense>
      <SignupScreen step={step as SignupStep} />
    </Suspense>
  );
}
