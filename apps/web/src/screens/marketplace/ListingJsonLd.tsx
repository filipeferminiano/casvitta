import type { PublicListing } from '@/lib/data/marketplace';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://casvitta.com.br';

/** schema.org RealEstateListing for search engines (one per listing card and property page). */
export function ListingJsonLd({ listing, url }: { listing: PublicListing; url: string }) {
  const p = listing.property;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    url: url.startsWith('http') ? url : `${SITE}${url}`,
    name: `${p.shortName} · ${p.neighborhood}`,
    datePosted: p.createdAt,
    offers: {
      '@type': 'Offer',
      price: p.priceCents / 100,
      priceCurrency: 'BRL',
      businessFunction:
        p.transaction === 'rent'
          ? 'https://purl.org/goodrelations/v1#LeaseOut'
          : 'https://purl.org/goodrelations/v1#Sell',
    },
    about: {
      '@type': p.kind === 'house' ? 'SingleFamilyResidence' : 'Apartment',
      numberOfRooms: p.bedrooms,
      floorSize: { '@type': 'QuantitativeValue', value: p.areaM2, unitCode: 'MTK' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: p.street,
        addressLocality: p.city,
        addressRegion: p.state,
        addressCountry: 'BR',
      },
    },
    provider: {
      '@type': 'RealEstateAgent',
      name: listing.broker.displayName,
      identifier: `CRECI-${listing.broker.creciState} ${listing.broker.creciNumber}`,
    },
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be inline; the content is our own serialized data, not user HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
