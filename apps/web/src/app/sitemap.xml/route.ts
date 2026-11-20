import { requestSite } from '@/lib/request-site';
import { sitemapFor } from '@/lib/seo';
import { sitemapIndex, urlset, xmlResponse } from '@/lib/sitemap-xml';

/**
 * Marketplace host: a sitemap index (static pages + one sitemap per price-page template).
 * Broker hosts: their broker page and property pages. Broker OS host: empty.
 */
export async function GET() {
  const { site, origin } = await requestSite();
  if (site.kind === 'marketplace') return xmlResponse(sitemapIndex(origin));
  return xmlResponse(urlset(sitemapFor(site, origin)));
}
