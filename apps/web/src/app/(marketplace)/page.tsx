import { EmptyState } from '@casvitta/ui';
import { House } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function MarketplaceHome() {
  const t = await getTranslations('marketplace');
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      <h1 className="type-display-l md:type-display-xl">{t('title')}</h1>
      <EmptyState
        icon={<House strokeWidth={1.6} />}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
      />
    </div>
  );
}
