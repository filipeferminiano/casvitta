import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getBrokerPage } from '@/lib/data/marketplace';
import { BrokerLanding } from '@/screens/landing/LandingPages';

type Props = { params: Promise<{ brokerSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brokerSlug } = await params;
  const page = getBrokerPage(brokerSlug);
  if (!page) return {};
  const t = await getTranslations('landing');
  return {
    title: t('brokerMetaTitle', { name: page.broker.displayName }),
    robots: page.broker.isDemo ? { index: false, follow: false } : undefined,
  };
}

/** Mockup 41: generated from the broker profile and published properties, never free HTML. */
export default async function BrokerLandingPage({ params }: Props) {
  const { brokerSlug } = await params;
  const page = getBrokerPage(brokerSlug);
  if (!page) notFound();
  return <BrokerLanding broker={page.broker} />;
}
