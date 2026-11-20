import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatBRL } from '@/lib/format';
import { getFinancing, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { FinancingScreen } from '@/screens/market/FinancingScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const page = await getFinancing(cidade, bairro);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.meta');
  const name = page.neighborhood.name;
  const sac = page.simulations.find((s) => s.system === 'sac');
  return marketMetadata({
    title: t('financingTitle', { name }),
    description: sac
      ? t('financingDescription', { name, income: formatBRL(sac.min_income_cents) })
      : t('financingDescriptionFew', { name }),
    path: `/financiamento/${page.city.slug}/${page.neighborhood.slug}`,
    indexable: page.gate.indexable,
  });
}

export default async function Page({ params }: Props) {
  const { cidade, bairro } = await params;
  const page = await getFinancing(cidade, bairro);
  if (!page) notFound();
  if (isRedirect(page)) permanentRedirect(page.path);
  return <FinancingScreen page={page} />;
}
