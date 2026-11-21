import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { searchListings } from '@/lib/data/marketplace';
import { onlyPlaceFilter, seoListingsPath } from '@/lib/listings-canonical';
import { parseFilters } from '@/lib/search-params';
import { SearchScreen } from '@/screens/marketplace/SearchScreen';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const toParams = (raw: Record<string, string | string[] | undefined>) =>
  new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  );

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations('search');
  const filters = parseFilters(toParams(await searchParams), 'rent');
  const place = filters.where?.split(',')[0]?.trim();
  return {
    title: t('metaTitle', {
      transaction: 'rent',
      place: place ?? '',
      hasPlace: String(Boolean(place)),
    }),
    alternates: { canonical: (await seoListingsPath('rent', filters.where)) ?? '/alugar' },
    // Filtered variants of the search are not indexed; the clean SEO URL is.
    ...([...toParams(await searchParams).keys()].length
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

/** Mockup 53: results list + map for rent. */
export default async function Page({ searchParams }: Props) {
  const params = toParams(await searchParams);
  const seo = await seoListingsPath('rent', params.get('onde'));
  if (seo && onlyPlaceFilter(params)) permanentRedirect(seo);
  const filters = parseFilters(toParams(await searchParams), 'rent');
  return <SearchScreen filters={filters} results={searchListings(filters)} />;
}
