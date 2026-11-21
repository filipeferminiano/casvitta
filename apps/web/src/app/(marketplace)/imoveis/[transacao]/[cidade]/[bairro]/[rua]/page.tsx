import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { MIN_LISTINGS_INDEXABLE, getLiveListings } from '@/lib/data/listings';
import { getNeighborhood, getStreet, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { ListingsScreen, type Transaction } from '@/screens/market/ListingsScreen';

export const revalidate = 3600;

type Props = {
  params: Promise<{ transacao: string; cidade: string; bairro: string; rua: string }>;
};

async function load(transacao: string, cidade: string, bairro: string, rua: string) {
  if (transacao !== 'venda' && transacao !== 'aluguel') return null;
  const [neighborhood, street] = await Promise.all([
    getNeighborhood(cidade, bairro),
    getStreet(cidade, bairro, rua),
  ]);
  if (!neighborhood || isRedirect(neighborhood) || !street || isRedirect(street)) return null;
  const listings = await getLiveListings({
    transaction: transacao === 'venda' ? 'sale' : 'rent',
    city: cidade,
    neighborhood: bairro,
    street: rua,
  });
  return { transaction: transacao as Transaction, neighborhood, street, listings };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { transacao, cidade, bairro, rua } = await params;
  const data = await load(transacao, cidade, bairro, rua);
  if (!data) return {};
  const t = await getTranslations('market.listings');
  const where = t('whereStreet', { street: data.street.street.name });
  const rent = data.transaction === 'aluguel';
  return marketMetadata({
    title: t(rent ? 'metaTitleRent' : 'metaTitleSale', { where, count: data.listings.length }),
    description: t(rent ? 'zeroRent' : 'zeroSale', { where }),
    path: `/imoveis/${transacao}/${cidade}/${bairro}/${rua}`,
    indexable: data.neighborhood.gate.indexable && data.listings.length >= MIN_LISTINGS_INDEXABLE,
  });
}

export default async function Page({ params }: Props) {
  const { transacao, cidade, bairro, rua } = await params;
  const data = await load(transacao, cidade, bairro, rua);
  if (!data) notFound();
  return <ListingsScreen {...data} />;
}
