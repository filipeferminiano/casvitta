import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getListingBySlug } from '@/lib/data/marketplace';
import { PropertyDetail } from '@/screens/marketplace/PropertyDetail';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) return {};
  const t = await getTranslations('listing');
  const { property: p } = listing;
  return {
    title: `${t(`kinds.${p.kind}`)} · ${p.neighborhood}`,
    // Demo records stay out of search results.
    robots: p.isDemo ? { index: false, follow: false } : undefined,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) notFound();
  return <PropertyDetail listing={listing} />;
}
