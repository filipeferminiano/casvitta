import { SITEMAP_TEMPLATES, getSitemap, type SitemapTemplate } from '@/lib/data/market';
import { requestSite } from '@/lib/request-site';
import { marketUrlset, urlset, xmlResponse } from '@/lib/sitemap-xml';

type Context = { params: Promise<{ city: string; file: string }> };

/** /sitemaps/{city}/{bairros|ruas|condominios|financiamento}.xml: indexable price pages only. */
export async function GET(_request: Request, { params }: Context) {
  const { city, file } = await params;
  const template = file.replace(/\.xml$/, '') as SitemapTemplate;
  const { site, origin } = await requestSite();
  if (site.kind !== 'marketplace' || !SITEMAP_TEMPLATES.includes(template)) {
    return xmlResponse(urlset([]), 404);
  }
  const sitemap = await getSitemap(city, template);
  if (!sitemap) return xmlResponse(urlset([]), 404);
  return xmlResponse(marketUrlset(origin, sitemap));
}
