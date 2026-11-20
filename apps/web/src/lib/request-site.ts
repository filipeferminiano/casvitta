import { headers } from 'next/headers';

import { SITE_URL } from '@/config/site';
import { resolveSite, type Site } from '@/lib/hosts';
import { siteOrigin } from '@/lib/seo';

/**
 * The site and public origin of the current request, for metadata routes (sitemap, robots,
 * llms.txt). Those paths have an extension, so src/proxy.ts does not rewrite them per host.
 */
export async function requestSite(): Promise<{
  site: Site;
  origin: string;
  isProductionDomain: boolean;
}> {
  const h = await headers();
  const rootDomain = process.env.ROOT_DOMAIN ?? 'localhost:3000';
  const site = resolveSite(
    h.get('x-forwarded-host') ?? h.get('host') ?? '',
    rootDomain,
    process.env.APP_SUBDOMAIN ?? 'app',
  );
  return {
    site,
    origin: siteOrigin(site, SITE_URL, rootDomain),
    // Demo deploys (run.app, previews) stay out of search.
    isProductionDomain: new URL(SITE_URL).hostname.endsWith('casvitta.com.br'),
  };
}
