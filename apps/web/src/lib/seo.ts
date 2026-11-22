import type { MetadataRoute } from 'next';

import { getBrokerPage, listPublicListings } from '@/lib/data/marketplace';
import type { Site } from '@/lib/hosts';

/** Indexable marketplace pages. Signup, sign-in and per-person pages stay out (see robots). */
export const MARKETPLACE_PAGES = [
  { path: '', priority: 1 },
  { path: '/comprar', priority: 0.9 },
  { path: '/alugar', priority: 0.9 },
  { path: '/para-corretores', priority: 0.8 },
  { path: '/anunciar-imovel', priority: 0.8 },
  { path: '/para-imobiliarias', priority: 0.8 },
  { path: '/precos', priority: 0.7 },
  { path: '/anunciar-imovel/corretor', priority: 0.5 },
  { path: '/investidores', priority: 0.6 },
  { path: '/incorporadoras', priority: 0.5 },
  { path: '/leilao', priority: 0.5 },
  { path: '/mapa-do-site', priority: 0.5 },
  { path: '/sobre', priority: 0.3 },
  { path: '/privacidade', priority: 0.2 },
  { path: '/termos', priority: 0.2 },
] as const;

const DISALLOW = [
  '/cadastro',
  '/entrar',
  '/leilao/confirmado',
  '/favoritos',
  '/minhas-visitas',
  '/api/',
  '/dev/',
  '/app/',
];

/**
 * Crawlers named explicitly so the policy toward AI search and training is visible in
 * robots.txt (GEO). They get the same rules as everyone else; training is allowed on purpose.
 */
export const AI_CRAWLERS = [
  // Answer engines: fetch pages to cite them in answers.
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
  'Bingbot',
  // Training and grounding.
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
] as const;

/** Public origin of a host: the marketplace origin, or https://{slug}.{rootDomain}. */
export function siteOrigin(site: Site, siteUrl: string, rootDomain: string): string {
  if (site.kind !== 'landing') return siteUrl;
  return `${new URL(siteUrl).protocol}//${site.brokerSlug}.${rootDomain}`;
}

/** Sitemap for the requesting host. Demo records never appear (CLAUDE.md §4.7). */
export function sitemapFor(site: Site, origin: string): MetadataRoute.Sitemap {
  switch (site.kind) {
    case 'marketplace': {
      const listings = listPublicListings()
        .filter(({ property, broker }) => !property.isDemo && isPublicBroker(broker))
        .map(({ property }) => ({
          url: `${origin}/imovel/${property.slug}`,
          lastModified: property.createdAt,
          priority: 0.7,
        }));
      return [
        ...MARKETPLACE_PAGES.map(({ path, priority }) => ({ url: `${origin}${path}`, priority })),
        ...listings,
      ];
    }
    case 'landing': {
      const page = getBrokerPage(site.brokerSlug);
      if (!page || !isPublicBroker(page.broker)) return [];
      return [
        { url: origin, priority: 1 },
        ...page.properties
          .filter((p) => !p.isDemo)
          .map((p) => ({ url: `${origin}/${p.slug}`, lastModified: p.createdAt, priority: 0.8 })),
      ];
    }
    case 'app':
    case 'backoffice':
    case 'reserved':
      return [];
  }
}

/** robots.txt for the requesting host. Only the production domain is ever indexed. */
export function robotsFor(
  site: Site,
  origin: string,
  isProductionDomain: boolean,
): MetadataRoute.Robots {
  if (
    !isProductionDomain ||
    site.kind === 'app' ||
    site.kind === 'backoffice' ||
    site.kind === 'reserved'
  ) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: [
      { userAgent: [...AI_CRAWLERS], allow: '/', disallow: DISALLOW },
      { userAgent: '*', allow: '/', disallow: DISALLOW },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

/** A broker's pages are public only with a staff-verified CRECI (CLAUDE.md §4.1). */
function isPublicBroker(broker: { isDemo: boolean; creciVerifiedAt: string | null }): boolean {
  return !broker.isDemo && broker.creciVerifiedAt !== null;
}
