import { getTranslations } from 'next-intl/server';

import { AgendaScreen } from '@/screens/agenda/AgendaScreen';

export async function generateMetadata() {
  const t = await getTranslations('agenda');
  return { title: t('title') };
}

export default function Page() {
  return <AgendaScreen />;
}
