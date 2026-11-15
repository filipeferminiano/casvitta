import { getTranslations } from 'next-intl/server';

import { ModuleStoreScreen } from '@/screens/modules/ModuleStoreScreen';

export async function generateMetadata() {
  const t = await getTranslations('store');
  return { title: t('title') };
}

export default function Page() {
  return <ModuleStoreScreen />;
}
