import { EmptyState } from '@casvitta/ui';
import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PropertyLandingPage() {
  const t = await getTranslations('landing');
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <EmptyState
        icon={<Building2 strokeWidth={1.6} />}
        title={t('propertyEmptyTitle')}
        description={t('propertyEmptyDescription')}
      />
    </div>
  );
}
