import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { isLive } from '@/lib/live';
import { PropertyScreen } from '@/screens/crm/PropertyScreen';

export async function generateMetadata() {
  const t = await getTranslations('crm.properties');
  return { title: t('title') };
}

/** CR5 · Publicado. */
export default async function Page({ params }: { params: Promise<{ propertyId: string }> }) {
  if (!isLive('crm')) notFound();
  const { propertyId } = await params;
  return <PropertyScreen id={propertyId} />;
}
