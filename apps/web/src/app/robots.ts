import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { SITE_URL } from '@/config/site';
import { resolveSite } from '@/lib/hosts';

/**
 * Marketplace: capture pages are indexable; signup, sign-in and confirmation are not.
 * The Broker OS host is never indexed. Landing hosts follow the marketplace rules.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? '';
  const site = resolveSite(
    host,
    process.env.ROOT_DOMAIN ?? 'localhost:3000',
    process.env.APP_SUBDOMAIN ?? 'app',
  );
  // Only the real domain is indexed; demo deploys (run.app, previews) stay out of search.
  const isProductionDomain = new URL(SITE_URL).hostname.endsWith('casvitta.com.br');
  if (!isProductionDomain || site.kind === 'app' || site.kind === 'reserved') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/cadastro',
        '/entrar',
        '/leilao/confirmado',
        '/favoritos',
        '/minhas-visitas',
        '/api/',
        '/dev/',
        '/app/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
