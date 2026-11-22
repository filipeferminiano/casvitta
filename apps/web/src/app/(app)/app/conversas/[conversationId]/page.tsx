import { getTranslations } from 'next-intl/server';

import { redirect } from 'next/navigation';

import { isLive } from '@/lib/live';
import { ConversationScreen } from '@/screens/conversations/ConversationScreen';

export async function generateMetadata() {
  const t = await getTranslations('conversations');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  // The live inbox keeps the list and the thread on one page (?c=).
  if (isLive('crm')) redirect(`/conversas?c=${conversationId}`);
  return <ConversationScreen conversationId={conversationId} />;
}
