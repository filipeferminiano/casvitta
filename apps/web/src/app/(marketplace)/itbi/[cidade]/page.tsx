import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getItbi } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { ItbiScreen } from '@/screens/market/ItbiScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string }> };

/** Keyword map #2. Noindex until the rules are reviewed (ITBI_SP_RULES_REVIEWED). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade } = await params;
  const page = await getItbi(cidade);
  if (!page) return {};
  const t = await getTranslations('market.itbi');
  const pct = (bps: number) => (bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return marketMetadata({
    title: t('metaTitle', { city: page.city.name, year: page.rules.effective_from.slice(0, 4) }),
    description: t('lead', {
      rate: pct(page.rules.rate_bps),
      sfhRate: pct(page.rules.sfh_rate_bps),
    }),
    path: page.city.path,
    indexable: page.rules.reviewed,
  });
}

export default async function Page({ params }: Props) {
  const { cidade } = await params;
  const page = await getItbi(cidade);
  if (!page) notFound();
  return <ItbiScreen page={page} />;
}
