import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { searchListings } from '@/lib/data/marketplace';
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
    alternates: { canonical: '/alugar' },
  };
}

/** Mockup 53: results list + map for rent. */
export default async function Page({ searchParams }: Props) {
  const filters = parseFilters(toParams(await searchParams), 'rent');
  return <SearchScreen filters={filters} results={searchListings(filters)} />;
}
