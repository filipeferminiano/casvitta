import { requestSite } from '@/lib/request-site';
import { sitemapFor } from '@/lib/seo';
import { urlset, xmlResponse } from '@/lib/sitemap-xml';

/** Marketplace static pages and published listings (see lib/seo.ts). */
export async function GET() {
  const { site, origin } = await requestSite();
  if (site.kind !== 'marketplace') return xmlResponse(urlset([]), 404);
  return xmlResponse(urlset(sitemapFor(site, origin)));
}
