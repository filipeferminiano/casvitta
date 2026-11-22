import { getTranslations } from 'next-intl/server';

import { isLive } from '@/lib/live';
import { CrmHomeScreen } from '@/screens/crm/HomeScreen';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';

export async function generateMetadata() {
  const t = await getTranslations('app.home');
  return { title: t('title') };
}

export default function Page() {
  return isLive('crm') ? <CrmHomeScreen /> : <DashboardScreen />;
}
