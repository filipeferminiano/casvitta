'use client';

import { Button, EmptyState, ErrorState, LoadingState } from '@casvitta/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type Props<T> = {
  query: UseQueryResult<T>;
  /** What is loading, e.g. "seus leads" — used in loading and error copy. */
  subject: string;
  isEmpty?: (data: T) => boolean;
  empty?: { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode };
  children: (data: NonNullable<T>) => ReactNode;
};

/** Every list/screen implements loading, empty and error (DESIGN_SYSTEM §6). */
export function ScreenStates<T>({ query, subject, isEmpty, empty, children }: Props<T>) {
  const t = useTranslations('states');
  if (query.isPending) {
    return (
      <LoadingState title={t('loadingTitle', { subject })} description={t('loadingDescription')} />
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title={t('errorTitle', { subject })}
        stillWorks={t('errorStillWorks')}
        howToFix={t('errorHowToFix')}
        primaryAction={<Button onClick={() => query.refetch()}>{t('retry')}</Button>}
      />
    );
  }
  const data = query.data;
  if (data === null || data === undefined || (isEmpty && isEmpty(data))) {
    return (
      <EmptyState
        icon={empty?.icon}
        title={empty?.title ?? t('emptyTitle')}
        description={empty?.description}
        actions={empty?.actions}
      />
    );
  }
  return <>{children(data as NonNullable<T>)}</>;
}
