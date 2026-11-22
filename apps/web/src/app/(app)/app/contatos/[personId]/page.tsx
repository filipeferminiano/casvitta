import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { isLive } from '@/lib/live';
import { ContactScreen } from '@/screens/crm/ContactScreen';

export async function generateMetadata() {
  const t = await getTranslations('crm.contacts');
  return { title: t('title') };
}

/** CR2 · Contato 360. */
export default async function Page({ params }: { params: Promise<{ personId: string }> }) {
  if (!isLive('crm')) notFound();
  const { personId } = await params;
  return <ContactScreen id={personId} />;
}
