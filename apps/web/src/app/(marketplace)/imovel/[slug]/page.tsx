import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { SITE_URL } from '@/config/site';
import { getLiveListing } from '@/lib/data/live-listing';
import { getListingBySlug } from '@/lib/data/marketplace';
import { isLive } from '@/lib/live';
import { LiveListingScreen } from '@/screens/marketplace/LiveListingScreen';
import { PropertyDetail } from '@/screens/marketplace/PropertyDetail';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isLive('listings')) {
    const live = await getLiveListing(slug);
    if (!live) return {};
    const tKinds = await getTranslations('crm.properties.kinds');
    return {
      title: live.title ?? `${tKinds(live.kind)} · ${live.neighborhood}`,
      alternates: { canonical: `${SITE_URL}/imovel/${live.slug}` },
    };
  }
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
  if (isLive('listings')) {
    // Real listings only: they passed CRECI, the owner's authorization and the Casvitta check.
    const live = await getLiveListing(slug);
    if (!live) notFound();
    return <LiveListingScreen listing={live} pageUrl={`${SITE_URL}/imovel/${live.slug}`} />;
  }
  const listing = getListingBySlug(slug);
  if (!listing) notFound();
  return <PropertyDetail listing={listing} />;
}
