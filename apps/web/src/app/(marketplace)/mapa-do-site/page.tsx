import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getCityIndex } from '@/lib/data/market';
import { NAV_CITY, navHoods, SITE_MAP_PATH } from '@/lib/site-nav';
import { SiteMapScreen } from '@/screens/marketplace/SiteMapScreen';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('siteMap');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: SITE_MAP_PATH },
  };
}

/** Every public page by topic (docs/mockups/navigation/site-map). */
export default async function Page() {
  const hoods = navHoods(await getCityIndex(NAV_CITY).catch(() => null));
  return <SiteMapScreen hoods={hoods} />;
}
