import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { publicMetadata } from '@/lib/metadata';
import { AuctionConfirmation } from '@/screens/marketplace/AuctionConfirmation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auction.done.meta');
  return publicMetadata({
    title: t('title'),
    description: t('description'),
    path: '/leilao/confirmado',
    noindex: true,
  });
}

/** Mockup 61. */
export default function Page() {
  return <AuctionConfirmation />;
}
