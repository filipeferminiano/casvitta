import { getTranslations } from 'next-intl/server';

import { isLive } from '@/lib/live';
import { AgendaScreen } from '@/screens/agenda/AgendaScreen';
import { CalendarScreen } from '@/screens/crm/CalendarScreen';

export async function generateMetadata() {
  const t = await getTranslations('agenda');
  return { title: t('title') };
}

export default function Page() {
  return isLive('crm') ? <CalendarScreen /> : <AgendaScreen />;
}
