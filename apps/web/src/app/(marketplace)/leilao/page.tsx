import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuctionScreen } from '@/screens/marketplace/AuctionScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auction.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/leilao' },
  };
}

/** Mockup 59, 60. */
export default function Page() {
  return <AuctionScreen />;
}
