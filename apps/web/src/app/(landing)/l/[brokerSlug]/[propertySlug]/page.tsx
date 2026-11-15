import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getListingBySlug } from '@/lib/data/marketplace';
import { PropertyLanding } from '@/screens/landing/LandingPages';

type Props = { params: Promise<{ brokerSlug: string; propertySlug: string }> };

function load(brokerSlug: string, propertySlug: string) {
  const listing = getListingBySlug(propertySlug);
  return listing && listing.broker.slug === brokerSlug ? listing : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brokerSlug, propertySlug } = await params;
  const listing = load(brokerSlug, propertySlug);
  if (!listing) return {};
  const t = await getTranslations('listing');
  return {
    title: `${t(`kinds.${listing.property.kind}`)} · ${listing.property.neighborhood}`,
    robots: listing.property.isDemo ? { index: false, follow: false } : undefined,
  };
}

/** Mockup 40: the property page on {brokerSlug}.casvitta.com.br/{propertySlug}. */
export default async function PropertyLandingPage({ params }: Props) {
  const { brokerSlug, propertySlug } = await params;
  const listing = load(brokerSlug, propertySlug);
  if (!listing) notFound();
  return <PropertyLanding listing={listing} />;
}
