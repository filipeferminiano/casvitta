import { cardLinkClass, EmptyState, PropertyCard } from '@casvitta/ui';
import { House } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { CreciBadge, DemoBadge, SponsoredBadge } from '@/components/badges';
import type { PublicListing } from '@/lib/data/marketplace';
import { formatBRL } from '@/lib/format';

import { ListingJsonLd } from './ListingJsonLd';

/** Grid of public listings; every card shows the responsible broker's CRECI. */
export async function ListingGrid({
  listings,
  emptyTitle,
  emptyDescription,
  hrefFor = (l) => `/imovel/${l.property.slug}`,
  columns = 3,
}: {
  listings: PublicListing[];
  emptyTitle: string;
  emptyDescription: string;
  hrefFor?: (listing: PublicListing) => string;
  columns?: 3 | 4;
}) {
  const t = await getTranslations('listing');
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<House strokeWidth={1.6} />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <ul
      className={
        columns === 4
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
      }
    >
      {listings.map((listing) => {
        const p = listing.property;
        return (
          <li key={p.id}>
            <ListingJsonLd listing={listing} url={hrefFor(listing)} />
            <PropertyCard
              photoCaption={t('mainPhoto')}
              badges={
                <>
                  {listing.sponsored ? <SponsoredBadge /> : null}
                  {p.isDemo ? <DemoBadge /> : null}
                </>
              }
              title={
                <Link href={hrefFor(listing)} className={cardLinkClass}>
                  {`${t(`kinds.${p.kind}`)} · ${p.neighborhood}`}
                </Link>
              }
              price={
                p.transaction === 'rent'
                  ? t('perMonth', { amount: formatBRL(p.priceCents) })
                  : formatBRL(p.priceCents)
              }
              specs={[
                t('bedrooms', { count: p.bedrooms }),
                `${p.areaM2} m²`,
                p.parking ? t('parking', { count: p.parking }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              broker={
                <>
                  <span>{listing.broker.displayName}</span>
                  <CreciBadge broker={listing.broker} />
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
