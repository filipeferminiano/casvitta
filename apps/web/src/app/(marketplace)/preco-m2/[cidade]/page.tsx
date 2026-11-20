import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getCityIndex } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { CityIndexScreen } from '@/screens/market/CityIndexScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade } = await params;
  const page = await getCityIndex(cidade);
  if (!page) return {};
  const t = await getTranslations('market.meta');
  return marketMetadata({
    title: t('cityTitle', { city: page.city.name }),
    description: t('cityDescription', { city: page.city.name }),
    path: page.city.path,
    indexable: page.neighborhoods.some((n) => n.indexable),
  });
}

/** Price per m² by neighborhood, from real sales (ITBI). No mockup: see the SEO-1 plan. */
export default async function Page({ params }: Props) {
  const { cidade } = await params;
  const page = await getCityIndex(cidade);
  if (!page) notFound();
  return <CityIndexScreen page={page} />;
}
