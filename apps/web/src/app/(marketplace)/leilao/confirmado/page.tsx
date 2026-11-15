import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuctionConfirmation } from '@/screens/marketplace/AuctionConfirmation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auction.done.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/leilao/confirmado' },
    robots: { index: false },
  };
}

/** Mockup 61. */
export default function Page() {
  return <AuctionConfirmation />;
}
