import { EmptyState } from '@casvitta/ui';
import { UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

// Not published yet: keep placeholder pages out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BrokerLandingPage() {
  const t = await getTranslations('landing');
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <EmptyState
        icon={<UserRound strokeWidth={1.6} />}
        title={t('brokerEmptyTitle')}
        description={t('brokerEmptyDescription')}
      />
    </div>
  );
}
