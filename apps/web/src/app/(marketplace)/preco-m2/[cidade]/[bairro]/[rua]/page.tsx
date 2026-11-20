import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getStreet, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { formatPriceM2 } from '@/lib/market-format';
import { StreetScreen } from '@/screens/market/StreetScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string; rua: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro, rua } = await params;
  const page = await getStreet(cidade, bairro, rua);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.meta');
  const name = page.street.name;
  const neighborhood = page.neighborhood.name;
  const price = page.stats?.median_price_m2_cents;
  return marketMetadata({
    title:
      price != null
        ? t('streetTitle', { name, neighborhood, price: formatPriceM2(price) })
        : t('streetTitleFew', { name, neighborhood }),
    description: page.stats
      ? t('streetDescription', { name, neighborhood, sales: page.stats.sales })
      : t('streetDescriptionFew', { name, neighborhood }),
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
