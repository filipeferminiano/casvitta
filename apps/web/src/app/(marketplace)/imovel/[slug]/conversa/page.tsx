import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getListingBySlug, offeredSlots } from '@/lib/data/marketplace';
import { formatDayMonth, formatLongDay } from '@/lib/format';
import { simulateSac } from '@/lib/finance';
import { buyerChatScript } from '@/mocks/fixtures';
import { BuyerChat } from '@/screens/marketplace/BuyerScreens';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata() {
  const t = await getTranslations('buyer.chat');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) notFound();
  const t = await getTranslations('buyer.chat');
  const slots = offeredSlots();
  const first = slots[0];
  const sim = simulateSac({
    priceCents: listing.property.priceCents,
    downPaymentCents: Math.round(listing.property.priceCents * 0.2),
  });
  const offer = first
    ? t('offer', {
        // "perto de R$ 6,5 mil": rounded down to one decimal so the assistant never overpromises.
        amount: (Math.floor(sim.firstInstallmentCents / 10_000) / 10).toLocaleString('pt-BR'),
        weekday: (formatLongDay(first.startsAt).split(',')[0] ?? '').toLowerCase(),
        date: formatDayMonth(first.startsAt),
      })
    : t('offerNoSlots', { name: listing.broker.firstName });
  return (
    <BuyerChat
      property={listing.property}
      broker={listing.broker}
      slots={slots}
      script={[...buyerChatScript, { from: 'ai', text: offer }]}
    />
  );
}
