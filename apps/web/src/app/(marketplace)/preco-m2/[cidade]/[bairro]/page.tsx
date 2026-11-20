import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatBRL } from '@/lib/format';
import { getNeighborhood, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { formatPriceM2 } from '@/lib/market-format';
import { NeighborhoodScreen } from '@/screens/market/NeighborhoodScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const page = await getNeighborhood(cidade, bairro);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.meta');
  const name = page.neighborhood.name;
  const stats = page.stats;
  const year = page.source.window_end?.slice(0, 4) ?? '';
  return marketMetadata({
    title:
      stats?.median_price_m2_cents != null
        ? t('neighborhoodTitle', { name, price: formatPriceM2(stats.median_price_m2_cents), year })
        : t('neighborhoodTitleFew', { name }),
    description:
      stats?.median_value_cents != null
        ? t('neighborhoodDescription', {
            name,
            sales: stats.sales,
            value: formatBRL(stats.median_value_cents),
          })
        : t('neighborhoodDescriptionFew', { name }),
    path: page.neighborhood.path,
    indexable: page.gate.indexable,
  });
}

export default async function Page({ params }: Props) {
  const { cidade, bairro } = await params;
  const page = await getNeighborhood(cidade, bairro);
  if (!page) notFound();
  if (isRedirect(page)) permanentRedirect(page.path);
  return <NeighborhoodScreen page={page} />;
}
