/**
 * schema.org for price pages: BreadcrumbList on every page, Dataset on price pages (the
 * Prefeitura is the source), Place for neighborhoods and buildings. No FAQPage: these pages
 * have no question-and-answer content.
 */
import { SITE_URL } from '@/config/site';
import type { PlaceRef, PublicStats, SourceInfo } from '@/lib/data/market';

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be inline; the content is our own serialized data, not user HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

const absolute = (path: string) => `${SITE_URL}${path}`;

export function breadcrumbList(items: PlaceRef[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

export function dataset({
  name,
  description,
  path,
  place,
  stats,
  source,
  creator,
  license,
}: {
  name: string;
  description: string;
  path: string;
  place: string;
  stats: PublicStats | null | undefined;
  source: SourceInfo;
  creator: string;
  license: string;
}): Json {
  const data: Json = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url: absolute(path),
    inLanguage: 'pt-BR',
    isAccessibleForFree: true,
    creator: { '@type': 'GovernmentOrganization', name: creator },
    publisher: { '@id': `${SITE_URL}/#organization` },
    spatialCoverage: { '@type': 'Place', name: place },
    license,
  };
  if (stats) {
    data.temporalCoverage = `${stats.window_start ?? '2019-01-01'}/${stats.window_end}`;
  }
  if (source.refreshed_at) data.dateModified = source.refreshed_at;
  return data;
}

export function place({
  name,
  path,
  locality,
  street,
  containedIn,
}: {
  name: string;
  path: string;
  locality: string;
  street?: string;
  containedIn?: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name,
    url: absolute(path),
    address: {
      '@type': 'PostalAddress',
      ...(street ? { streetAddress: street } : {}),
      addressLocality: locality,
      addressRegion: 'SP',
      addressCountry: 'BR',
    },
    ...(containedIn ? { containedInPlace: { '@type': 'Place', name: containedIn } } : {}),
  };
}

/** Valuation and ITBI tools. */
export function webApplication({
  name,
  path,
  description,
}: {
  name: string;
  path: string;
  description: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: absolute(path),
    description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: 'pt-BR',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'BRL' },
  };
}
