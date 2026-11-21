import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getNeighborhood, isRedirect } from '@/lib/data/market';
import { formatBRL } from '@/lib/format';
import { marketMetadata } from '@/lib/market-metadata';
import { formatPriceM2 } from '@/lib/market-format';
import { NeighborhoodScreen } from '@/screens/market/NeighborhoodScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string }> };

/** Keyword map #4: title = H1 ("Preço do m² na [Bairro]: R$ X (vendas reais de [ano])"). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const page = await getNeighborhood(cidade, bairro);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.neighborhood');
  const inName = page.neighborhood.in_name ?? page.neighborhood.name;
  const stats = page.stats;
  const year = page.source.window_end?.slice(0, 4) ?? '';
  const priced = stats?.priced && stats.median_price_m2_cents != null;
  return marketMetadata({
    title: priced
      ? t('title', { inName, price: formatPriceM2(stats.median_price_m2_cents!), year })
      : t('titleFew', { inName }),
    // The meta description repeats the lead (what Google quotes).
    description:
      priced && stats.median_value_cents != null
        ? t(stats.financed_pct != null ? 'lead' : 'leadNoFinancing', {
            sales: stats.sales.toLocaleString('pt-BR'),
            inName,
            value: formatBRL(stats.median_value_cents),
            financed: stats.financed_pct ?? 0,
          })
        : t('leadFew', {
            sales: page.sales_12m.toLocaleString('pt-BR'),
            inName,
            min: page.gate.min_sales,
          }),
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
