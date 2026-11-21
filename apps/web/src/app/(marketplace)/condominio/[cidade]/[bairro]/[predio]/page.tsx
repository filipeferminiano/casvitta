import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatBRL } from '@/lib/format';
import { getBuilding, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { BuildingScreen } from '@/screens/market/BuildingScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string; predio: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro, predio } = await params;
  const page = await getBuilding(cidade, bairro, predio);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.building');
  const name = page.building.name;
  const neighborhood = page.neighborhood.name;
  const number = page.street_number.toLocaleString('pt-BR');
  const value = page.stats?.priced ? page.stats.median_value_cents : null;
  // Keyword map #3: "[Nome do prédio], [Rua], [número] – [Bairro]: vendas e apartamentos".
  return marketMetadata({
    title: t('metaTitle', { name, street: page.street.name, number, neighborhood }),
    description:
      value != null
        ? t('lead', { sales: page.sales, value: formatBRL(value) })
        : page.sales > 0
          ? t('leadFew', { sales: page.sales })
          : t('leadNone'),
    path: page.building.path,
    indexable: page.gate.indexable,
  });
}

export default async function Page({ params }: Props) {
  const { cidade, bairro, predio } = await params;
  const page = await getBuilding(cidade, bairro, predio);
  if (!page) notFound();
  if (isRedirect(page)) permanentRedirect(page.path);
  return <BuildingScreen page={page} />;
}
