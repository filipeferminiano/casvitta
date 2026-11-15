import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ConversationsScreen } from '@/screens/conversations/ConversationsScreen';

export async function generateMetadata() {
  const t = await getTranslations('conversations');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <ConversationsScreen />
    </Suspense>
  );
}
