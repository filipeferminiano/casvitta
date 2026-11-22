import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getPublicPage, movedTo } from '@/lib/data/page';
import { getBrokerPage } from '@/lib/data/marketplace';
import { isLive } from '@/lib/live';
import { BrokerLanding } from '@/screens/landing/LandingPages';
import { Storefront } from '@/screens/social/Storefront';

type Props = {
  params: Promise<{ brokerSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brokerSlug } = await params;
  if (isLive('social')) {
    const page = await getPublicPage(brokerSlug);
    if (!page) return {};
    const t = await getTranslations('social.storefront');
    return {
      title: { absolute: t('metaTitle', { name: page.display_name }) },
      description: page.bio ?? t('metaDescription', { name: page.display_name }),
      robots: page.is_demo ? { index: false, follow: false } : undefined,
    };
  }
  const page = getBrokerPage(brokerSlug);
  if (!page) return {};
  const t = await getTranslations('landing');
  return {
    title: t('brokerMetaTitle', { name: page.broker.displayName }),
    robots: page.broker.isDemo ? { index: false, follow: false } : undefined,
  };
}

/**
 * {slug}.casvitta.com.br. Live: Casvitta Social storefront (docs/mockups/social/01), generated from
 * the broker profile and the properties published on the page. Demo: mockup 41.
 */
export default async function BrokerLandingPage({ params, searchParams }: Props) {
  const { brokerSlug } = await params;
  if (isLive('social')) {
    const page = await getPublicPage(brokerSlug);
    if (!page) notFound();
    const moved = movedTo(page, brokerSlug, '', await searchParams);
    if (moved) permanentRedirect(moved);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: page.display_name,
      ...(page.creci ? { identifier: page.creci } : {}),
      ...(page.photo_url ? { image: page.photo_url } : {}),
      ...(page.regions.length ? { areaServed: page.regions } : {}),
    };
    return (
      <>
        <script
          type="application/ld+json"
          // JSON-LD must be inline; the content is our own serialized data, not user HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        <Storefront page={page} />
      </>
    );
  }
  const page = getBrokerPage(brokerSlug);
  if (!page) notFound();
  return <BrokerLanding broker={page.broker} />;
}
