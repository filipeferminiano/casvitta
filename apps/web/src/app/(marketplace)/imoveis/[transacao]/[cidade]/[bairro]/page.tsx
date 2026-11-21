import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { MIN_LISTINGS_INDEXABLE, getLiveListings } from '@/lib/data/listings';
import { getNeighborhood, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { ListingsScreen, type Transaction } from '@/screens/market/ListingsScreen';

export const revalidate = 3600;

type Props = { params: Promise<{ transacao: string; cidade: string; bairro: string }> };

async function load(transacao: string, cidade: string, bairro: string) {
  if (transacao !== 'venda' && transacao !== 'aluguel') return null;
  const neighborhood = await getNeighborhood(cidade, bairro);
  if (!neighborhood || isRedirect(neighborhood)) return null;
  const listings = await getLiveListings({
    transaction: transacao === 'venda' ? 'sale' : 'rent',
    city: cidade,
    neighborhood: bairro,
  });
  return { transaction: transacao as Transaction, neighborhood, listings };
}

/** Keyword map #7. Indexable with ≥ 3 live authorized listings of the transaction. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { transacao, cidade, bairro } = await params;
  const data = await load(transacao, cidade, bairro);
  if (!data) return {};
  const t = await getTranslations('market.listings');
  const where = data.neighborhood.neighborhood.in_name ?? data.neighborhood.neighborhood.name;
  const rent = data.transaction === 'aluguel';
  return marketMetadata({
    title: t(rent ? 'metaTitleRent' : 'metaTitleSale', { where, count: data.listings.length }),
    description: t(rent ? 'zeroRent' : 'zeroSale', { where }),
    path: `/imoveis/${transacao}/${cidade}/${bairro}`,
    indexable: data.neighborhood.gate.indexable && data.listings.length >= MIN_LISTINGS_INDEXABLE,
  });
}

export default async function Page({ params }: Props) {
  const { transacao, cidade, bairro } = await params;
  const data = await load(transacao, cidade, bairro);
  if (!data) notFound();
  return <ListingsScreen {...data} street={null} />;
}
