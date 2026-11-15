import { getTranslations } from 'next-intl/server';

import { ConversationScreen } from '@/screens/conversations/ConversationScreen';

export async function generateMetadata() {
  const t = await getTranslations('conversations');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return <ConversationScreen conversationId={conversationId} />;
}
