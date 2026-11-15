import { getTranslations } from 'next-intl/server';

import { listPublicListings } from '@/lib/data/marketplace';
import { ListingGrid } from '@/screens/marketplace/ListingGrid';

export default async function MarketplaceHome() {
  const t = await getTranslations('marketplace');
  const listings = listPublicListings();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12 xl:px-20">
      <h1 className="type-display-l md:type-display-xl">{t('title')}</h1>
      <ListingGrid
        listings={listings}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />
    </div>
  );
}
