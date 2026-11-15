import { Button, EmptyState } from '@casvitta/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export type MarketplaceSection = 'buy' | 'rent' | 'favorites' | 'visits' | 'signIn';

/** Marketplace pages linked from the header that have no approved design yet. */
export async function MarketplacePlaceholder({ section }: { section: MarketplaceSection }) {
  const t = await getTranslations('marketplace.placeholders');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="type-display-l">{t(`${section}.title`)}</h1>
      <EmptyState
        title={t(`${section}.emptyTitle`)}
        description={t(`${section}.emptyDescription`)}
        actions={
          <Button asChild variant="secondary">
            <Link href="/">{t('seeListings')}</Link>
          </Button>
        }
      />
    </div>
  );
}

export async function placeholderMetadata(section: MarketplaceSection) {
  const t = await getTranslations('marketplace.placeholders');
  return { title: t(`${section}.title`) };
}
