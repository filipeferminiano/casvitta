import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getListingBySlug } from '@/lib/data/marketplace';
import { getPublicPage } from '@/lib/data/page';
import { isLive } from '@/lib/live';
import { LiveListingScreen } from '@/screens/marketplace/LiveListingScreen';
import { PropertyLanding } from '@/screens/landing/LandingPages';
import { PropertyWhatsApp } from '@/screens/social/PropertyWhatsApp';

type Props = { params: Promise<{ brokerSlug: string; propertySlug: string }> };

function load(brokerSlug: string, propertySlug: string) {
  const listing = getListingBySlug(propertySlug);
  return listing && listing.broker.slug === brokerSlug ? listing : null;
}

/** A property shown on this broker's live page, or null (unpublished, other broker, not live). */
async function loadLive(brokerSlug: string, propertySlug: string) {
  const page = await getPublicPage(brokerSlug);
  const listing = page?.properties.find((p) => p.slug === propertySlug);
  return page && listing ? { page, listing } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brokerSlug, propertySlug } = await params;
  if (isLive('social')) {
    const found = await loadLive(brokerSlug, propertySlug);
    if (!found) return {};
    const tKinds = await getTranslations('crm.properties.kinds');
    const l = found.listing;
    return {
      title: { absolute: `${l.title ?? `${tKinds(l.kind)} · ${l.neighborhood}`} · ${l.code}` },
      robots: found.page.is_demo ? { index: false, follow: false } : undefined,
    };
  }
  const listing = load(brokerSlug, propertySlug);
  if (!listing) return {};
  const t = await getTranslations('listing');
  return {
    title: `${t(`kinds.${listing.property.kind}`)} · ${listing.property.neighborhood}`,
    robots: listing.property.isDemo ? { index: false, follow: false } : undefined,
  };
}

/** {brokerSlug}.casvitta.com.br/{propertySlug}: live (social/02) or demo (mockup 40). */
export default async function PropertyLandingPage({ params }: Props) {
  const { brokerSlug, propertySlug } = await params;
  if (isLive('social')) {
    const found = await loadLive(brokerSlug, propertySlug);
    if (!found) notFound();
    const { page, listing } = found;
    const tKinds = await getTranslations('crm.properties.kinds');
    return (
      <div data-page-theme={page.theme} className="min-h-dvh bg-canvas">
        <LiveListingScreen
          listing={listing}
          pageUrl={`/${listing.slug}`}
          contact={
            <PropertyWhatsApp
              slug={page.slug}
              code={listing.code}
              whatsappE164={page.whatsapp_e164}
              brokerName={page.display_name}
              title={listing.title ?? `${tKinds(listing.kind)} · ${listing.neighborhood}`}
            />
          }
        />
      </div>
    );
  }
  const listing = load(brokerSlug, propertySlug);
  if (!listing) notFound();
  return <PropertyLanding listing={listing} />;
}
