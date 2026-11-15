import { getTranslations } from 'next-intl/server';

import { VisitScreen } from '@/screens/agenda/VisitScreen';

export async function generateMetadata() {
  const t = await getTranslations('agenda');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  return <VisitScreen appointmentId={appointmentId} />;
}
