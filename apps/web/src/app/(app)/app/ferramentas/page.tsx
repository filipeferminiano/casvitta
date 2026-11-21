import { getTranslations } from 'next-intl/server';

import { getCityIndex } from '@/lib/data/market';
import { NAV_CITY, navHoods } from '@/lib/site-nav';
import { ToolsScreen } from '@/screens/tools/ToolsScreen';

export async function generateMetadata() {
  const t = await getTranslations('appTools');
  return { title: t('title') };
}

export default async function Page() {
  const hoods = navHoods(await getCityIndex(NAV_CITY).catch(() => null));
  return <ToolsScreen hoods={hoods} />;
}
