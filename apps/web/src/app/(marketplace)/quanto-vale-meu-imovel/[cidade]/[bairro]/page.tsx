import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getBuilding, getNeighborhood, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { ValuationScreen, type ValuationPrefill } from '@/screens/market/ValuationScreen';

type Props = {
  params: Promise<{ cidade: string; bairro: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Keyword map #1 (neighborhood). Indexable when the neighborhood is; ?predio= never changes the canonical. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const page = await getNeighborhood(cidade, bairro);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.valuation');
  const inName = page.neighborhood.in_name ?? page.neighborhood.name;
  const stats = page.stats?.priced ? page.stats : null;
  return marketMetadata({
    title: t('metaTitleNeighborhood', { inName }),
    description: stats
      ? t('leadNeighborhood', { sales: stats.sales.toLocaleString('pt-BR'), inName })
      : t('leadCity'),
    path: `/quanto-vale-meu-imovel/${cidade}/${bairro}`,
    indexable: page.gate.indexable,
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { cidade, bairro } = await params;
  const page = await getNeighborhood(cidade, bairro);
  if (!page) notFound();
  if (isRedirect(page))
    permanentRedirect(page.path.replace('/preco-m2/', '/quanto-vale-meu-imovel/'));
  // "Ver quanto vale" from a building page: prefill its street and number (a public building).
  const predio = (await searchParams).predio;
  let prefill: ValuationPrefill = null;
  if (typeof predio === 'string' && /^[a-z0-9-]{1,180}$/.test(predio)) {
    const building = await getBuilding(cidade, bairro, predio);
    if (building && !isRedirect(building)) {
      prefill = {
        neighborhood: bairro,
        street: building.street.slug,
        number: building.street_number,
        label: `${building.street.name}, ${building.street_number.toLocaleString('pt-BR')}`,
      };
    }
  }
  return (
    <ValuationScreen city={page.city} neighborhood={page} source={page.source} prefill={prefill} />
  );
}
