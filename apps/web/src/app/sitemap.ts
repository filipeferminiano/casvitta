import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/config/site';
import { listPublicListings } from '@/lib/data/marketplace';

/** Public marketplace pages and published, non-demo listings (rule 7 keeps demo out). */
const PAGES = [
  { path: '', priority: 1 },
  { path: '/comprar', priority: 0.9 },
  { path: '/alugar', priority: 0.9 },
  { path: '/para-corretores', priority: 0.8 },
  { path: '/anunciar-imovel', priority: 0.8 },
  { path: '/investidores', priority: 0.6 },
  { path: '/incorporadoras', priority: 0.5 },
  { path: '/leilao', priority: 0.5 },
  { path: '/sobre', priority: 0.3 },
  { path: '/privacidade', priority: 0.2 },
  { path: '/termos', priority: 0.2 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const listings = listPublicListings()
    .filter(({ property }) => !property.isDemo)
    .map(({ property }) => ({
      url: `${SITE_URL}/imovel/${property.slug}`,
      lastModified: property.createdAt,
      priority: 0.7,
    }));
  return [
    ...PAGES.map(({ path, priority }) => ({ url: `${SITE_URL}${path}`, priority })),
    ...listings,
  ];
}
