import { getTranslations } from 'next-intl/server';

import { ReportScreen } from '@/screens/ads/AdsScreens';

export async function generateMetadata() {
  const t = await getTranslations('ads');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <ReportScreen reportId={reportId} />;
}
