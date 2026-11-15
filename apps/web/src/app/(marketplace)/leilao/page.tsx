import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { AuctionScreen } from '@/screens/marketplace/AuctionScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auction.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/leilao',
  });
}

/** Mockup 59, 60. */
export default function Page() {
  return <AuctionScreen />;
}
