import type { MetadataRoute } from 'next';

import { requestSite } from '@/lib/request-site';
import { sitemapFor } from '@/lib/seo';

/**
 * Per host: marketplace pages and listings on casvitta.com.br; the broker page and its
 * property pages on {brokerSlug}.casvitta.com.br; nothing on the Broker OS host.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { site, origin } = await requestSite();
  return sitemapFor(site, origin);
}
