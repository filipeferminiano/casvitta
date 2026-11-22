import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { isLive } from '@/lib/live';
import { ContactsScreen } from '@/screens/crm/ContactsScreen';

export async function generateMetadata() {
  const t = await getTranslations('crm.contacts');
  return { title: t('title') };
}

/** CR1 · Contatos. Live CRM only; the demo build keeps Leads. */
export default function Page() {
  if (!isLive('crm')) notFound();
  return (
    <Suspense>
      <ContactsScreen />
    </Suspense>
  );
}
