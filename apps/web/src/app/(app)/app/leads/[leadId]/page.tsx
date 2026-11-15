import { getTranslations } from 'next-intl/server';

import { LeadDetailScreen } from '@/screens/leads/LeadDetailScreen';

export async function generateMetadata() {
  const t = await getTranslations('leads');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadDetailScreen leadId={leadId} />;
}
