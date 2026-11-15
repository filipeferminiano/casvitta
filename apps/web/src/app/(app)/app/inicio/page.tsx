import { getTranslations } from 'next-intl/server';

import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';

export async function generateMetadata() {
  const t = await getTranslations('app.home');
  return { title: t('title') };
}

export default function Page() {
  return <DashboardScreen />;
}
