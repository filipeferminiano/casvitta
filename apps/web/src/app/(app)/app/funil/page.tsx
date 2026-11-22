import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { isLive } from '@/lib/live';
import { PipelineScreen } from '@/screens/crm/PipelineScreen';

export async function generateMetadata() {
  const t = await getTranslations('crm.pipeline');
  return { title: t('title') };
}

/** CR3 · Funil. */
export default function Page() {
  if (!isLive('crm')) notFound();
  return <PipelineScreen />;
}
