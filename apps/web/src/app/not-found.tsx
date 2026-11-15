import Link from 'next/link';
import { Button, EmptyState } from '@casvitta/ui';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl items-center px-4">
      <EmptyState
        className="w-full"
        title={t('title')}
        description={t('description')}
        actions={
          <Button asChild variant="secondary">
            <Link href="/">{t('action')}</Link>
          </Button>
        }
      />
    </main>
  );
}
