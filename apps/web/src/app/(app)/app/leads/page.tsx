import { getTranslations } from 'next-intl/server';

import { LeadsScreen } from '@/screens/leads/LeadsScreen';

export async function generateMetadata() {
  const t = await getTranslations('leads');
  return { title: t('title') };
}

export default function Page() {
  return <LeadsScreen />;
}
