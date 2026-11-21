import { getTranslations } from 'next-intl/server';

import { formatBRL } from '@/lib/format';
import { FinancingSimulator } from '@/screens/marketplace/ListingIslands';

/**
 * Financing simulation on the price pages: the visitor is already looking at a place, so the
 * simulator starts from that place's median sale value (editable). Hidden without a published
 * median. Always a simulation (rule 5): the simulator carries its own label and disclaimer.
 */
export async function MarketSimulator({
  medianValueCents,
  where,
  itemId,
}: {
  medianValueCents: number | null | undefined;
  /** "na Vila Mariana", "na Rua Joaquim Távora", "em São Paulo". */
  where: string;
  itemId: string;
}) {
  if (medianValueCents == null || medianValueCents <= 0) return null;
  const t = await getTranslations('market.simulator');
  return (
    <section id="simulador" className="flex max-w-3xl scroll-mt-20 flex-col gap-2">
      <FinancingSimulator
        priceCents={medianValueCents}
        editablePrice
        itemId={itemId}
        title={t('title', { where })}
      />
      <p className="type-caption">{t('startsAt', { value: formatBRL(medianValueCents), where })}</p>
    </section>
  );
}
