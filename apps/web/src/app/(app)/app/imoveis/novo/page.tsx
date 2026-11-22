import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { isLive } from '@/lib/live';
import { PropertyFormScreen } from '@/screens/crm/PropertyFormScreen';

export async function generateMetadata() {
  const t = await getTranslations('crm.properties.form');
  return { title: t('title') };
}

/** CR4 · Cadastrar imóvel. */
export default function Page() {
  if (!isLive('crm')) notFound();
  return <PropertyFormScreen />;
}
