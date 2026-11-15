import { getTranslations } from 'next-intl/server';

import { CampaignScreen } from '@/screens/ads/AdsScreens';

export async function generateMetadata() {
  const t = await getTranslations('ads');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return <CampaignScreen campaignId={listingId} />;
}
