import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getCityIndex } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { NAV_CITY, navHoods } from '@/lib/site-nav';
import { CityListingsScreen } from '@/screens/marketplace/CityListingsScreen';

export const revalidate = 3600;

type Props = { params: Promise<{ transacao: string; cidade: string }> };

const TRANSACTIONS = { venda: 'sale', aluguel: 'rent' } as const;

function parse(transacao: string, cidade: string) {
  if (cidade !== NAV_CITY || !(transacao in TRANSACTIONS)) return null;
  return TRANSACTIONS[transacao as keyof typeof TRANSACTIONS];
}

/**
 * "Ver todos os bairros" from the menus: the city's neighborhoods with links into the listings.
 * Not indexed until the listings come from real published records (the API has no listings
 * domain yet, see lib/data/listings.ts); links are followed.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { transacao, cidade } = await params;
  const transaction = parse(transacao, cidade);
  if (!transaction) return {};
  const t = await getTranslations('cityListings');
  return marketMetadata({
    title: t(transaction === 'sale' ? 'metaTitleSale' : 'metaTitleRent'),
    description: t('metaDescription'),
    path: `/imoveis/${transacao}/${cidade}`,
    indexable: false,
  });
}

export default async function Page({ params }: Props) {
  const { transacao, cidade } = await params;
  const transaction = parse(transacao, cidade);
  if (!transaction) notFound();
  const index = await getCityIndex(cidade).catch(() => null);
  return <CityListingsScreen transaction={transaction} hoods={navHoods(index)} index={index} />;
}
