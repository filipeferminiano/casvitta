import Link from 'next/link';
import { Button, EmptyState } from '@casvitta/ui';
import type { LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export type AppPageKey =
  | 'home'
  | 'properties'
  | 'leads'
  | 'conversations'
  | 'calendar'
  | 'proposals'
  | 'ads'
  | 'moduleStore'
  | 'settings';

type Props = {
  page: AppPageKey;
  icon: LucideIcon;
  /** Optional link to another existing screen. No buttons that do nothing. */
  action?: { href: string; labelKey: 'emptyAction' };
};

/** Broker OS screen that has no feature yet: page title + EmptyState with real copy. */
export async function PlaceholderPage({ page, icon: Icon, action }: Props) {
  const t = await getTranslations(`app.${page}`);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-title lg:type-display-l">{t('title')}</h1>
      <EmptyState
        icon={<Icon strokeWidth={1.6} />}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
        actions={
          action ? (
            <Button asChild variant="secondary">
              <Link href={action.href}>{t(action.labelKey)}</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

export async function placeholderMetadata(page: AppPageKey) {
  const t = await getTranslations(`app.${page}`);
  return { title: t('title') };
}
