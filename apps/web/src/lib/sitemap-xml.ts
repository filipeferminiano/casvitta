/** Sitemap XML (sitemaps.org). /sitemap.xml is an index on the marketplace host. */
import type { MetadataRoute } from 'next';

import { MARKET_CITIES, SITEMAP_TEMPLATES, type Sitemap } from '@/lib/data/market';

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const lastmod = (value: string | Date | undefined | null) =>
  value ? `<lastmod>${new Date(value).toISOString()}</lastmod>` : '';

export function urlset(entries: MetadataRoute.Sitemap): string {
  const urls = entries
    .map(
      (e) =>
        `<url><loc>${escape(e.url)}</loc>${lastmod(e.lastModified)}${
          e.priority != null ? `<priority>${e.priority}</priority>` : ''
        }</url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

/** Child sitemaps of the marketplace: static pages, then one per price-page template and city. */
export function sitemapPaths(): string[] {
  return [
    '/sitemaps/paginas.xml',
    ...MARKET_CITIES.flatMap((city) => SITEMAP_TEMPLATES.map((t) => `/sitemaps/${city}/${t}.xml`)),
  ];
}

export function sitemapIndex(origin: string, paths: string[] = sitemapPaths()): string {
  const items = paths
    .map((p) => `<sitemap><loc>${escape(`${origin}${p}`)}</loc></sitemap>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>\n`;
}

/** A price-page sitemap from the API: only indexable pages, lastmod = data refresh. */
export function marketUrlset(origin: string, sitemap: Sitemap): string {
  return urlset(
    sitemap.entries.map((e) => ({
      url: `${origin}${e.path}`,
      lastModified: e.last_modified ?? undefined,
    })),
  );
}

export function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
