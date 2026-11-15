import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getListingBySlug } from '@/lib/data/marketplace';
import { VisitConfirmed } from '@/screens/marketplace/BuyerScreens';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata() {
  const t = await getTranslations('buyer.confirmed');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) notFound();
  return (
    <Suspense>
      <VisitConfirmed property={listing.property} broker={listing.broker} />
    </Suspense>
  );
}
