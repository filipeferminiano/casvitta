import { Button, EmptyState } from '@casvitta/ui';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('leads.newLeadPage');
  return { title: t('title') };
}

/** Linked from the Kanban "Novo lead" button; no mockup yet, so an honest placeholder. */
export default async function Page() {
  const t = await getTranslations('leads');
  return (
    <div className="flex flex-col gap-6 pt-6 md:pt-0">
      <h1 className="type-display-l">{t('newLeadPage.title')}</h1>
      <EmptyState
        icon={<UserPlus strokeWidth={1.6} />}
        title={t('newLeadPage.emptyTitle')}
        description={t('newLeadPage.emptyDescription')}
        actions={
          <Button asChild variant="secondary">
            <Link href="/leads">{t('title')}</Link>
          </Button>
        }
      />
    </div>
  );
}
