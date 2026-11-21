import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getCityIndex } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { ValuationScreen } from '@/screens/market/ValuationScreen';

export const revalidate = 86400;

const CITY = 'sao-paulo';

/** Keyword map #1 (city). */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('market.valuation');
  return marketMetadata({
    title: t('metaTitleCity', { city: 'São Paulo' }),
    description: t('leadCity'),
    path: '/quanto-vale-meu-imovel',
    indexable: true,
  });
}

export default async function Page() {
  // Prerendered at build time, when the API may be unreachable: the tool works without it.
  const index = await getCityIndex(CITY).catch(() => null);
  return (
    <ValuationScreen
      city={index?.city ?? { slug: CITY, name: 'São Paulo', path: `/preco-m2/${CITY}` }}
      neighborhood={null}
      source={index?.source ?? null}
      prefill={null}
    />
  );
}
