import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { isLive } from '@/lib/live';
import { ConversationsScreen } from '@/screens/conversations/ConversationsScreen';
import { InboxScreen } from '@/screens/crm/InboxScreen';

export async function generateMetadata() {
  if (isLive('crm')) return { title: (await getTranslations('crm.inbox'))('title') };
  const t = await getTranslations('conversations');
  return { title: t('title') };
}

export default function Page() {
  return <Suspense>{isLive('crm') ? <InboxScreen /> : <ConversationsScreen />}</Suspense>;
}
