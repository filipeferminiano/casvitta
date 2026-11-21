import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getStreet, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { StreetScreen } from '@/screens/market/StreetScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string; rua: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro, rua } = await params;
  const page = await getStreet(cidade, bairro, rua);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.street');
  const name = page.street.name;
  const neighborhood = page.neighborhood.name;
  // Keyword map #6: the title carries only the street and neighborhood (no "preço m²").
  return marketMetadata({
    title: t('metaTitle', { name, neighborhood }),
    description:
      page.last_12m && page.last_12m.sales > 0
        ? t('lead12', { sales: page.last_12m.sales, buildings: page.buildings.length })
        : t('lead36', { sales: page.sales_36m }),
    path: page.street.path,
    indexable: page.gate.indexable,
  });
}

export default async function Page({ params }: Props) {
  const { cidade, bairro, rua } = await params;
  const page = await getStreet(cidade, bairro, rua);
  if (!page) notFound();
  if (isRedirect(page)) permanentRedirect(page.path);
  return <StreetScreen page={page} />;
}
