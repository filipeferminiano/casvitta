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
  const t = await getTranslations('market.meta');
  const name = page.building.name;
  const neighborhood = page.neighborhood.name;
  const value = page.stats?.median_value_cents;
  return marketMetadata({
    title:
      value != null
        ? t('buildingTitle', { name, neighborhood, value: formatBRL(value) })
        : t('buildingTitleFew', { name, neighborhood }),
    description: page.stats
      ? t('buildingDescription', { name, neighborhood, sales: page.stats.sales })
      : t('buildingDescriptionFew', { name, neighborhood }),
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
