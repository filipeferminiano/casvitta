import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatBRLShort } from '@/lib/format';
import { formatIncome } from '@/lib/market-format';
import { getFinancing, isRedirect } from '@/lib/data/market';
import { marketMetadata } from '@/lib/market-metadata';
import { FinancingScreen } from '@/screens/market/FinancingScreen';

export const revalidate = 86400;

type Props = { params: Promise<{ cidade: string; bairro: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const page = await getFinancing(cidade, bairro);
  if (!page || isRedirect(page)) return {};
  const t = await getTranslations('market.financing');
  const inName = page.neighborhood.in_name ?? page.neighborhood.name;
  const sac = page.simulations.find((s) => s.system === 'sac');
  // Keyword map #5: "Quanto preciso ganhar para comprar na [Bairro]? Simulação".
  return marketMetadata({
    title: t('metaTitle', { inName }),
    description:
      sac && page.median_value_cents != null
        ? t(page.property_kind === 'apartment' ? 'leadApartment' : 'leadAll', {
            value: formatBRLShort(page.median_value_cents),
            down: page.down_payment_pct,
            years: page.term_months / 12,
            income: formatIncome(sac.min_income_cents),
          })
        : t('metaDescriptionFew', { inName }),
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
