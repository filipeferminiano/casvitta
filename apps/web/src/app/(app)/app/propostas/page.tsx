import { getTranslations } from 'next-intl/server';

import { ProposalsScreen } from '@/screens/proposals/ProposalsScreen';

export async function generateMetadata() {
  const t = await getTranslations('proposals');
  return { title: t('title') };
}

export default function Page() {
  return <ProposalsScreen />;
}
