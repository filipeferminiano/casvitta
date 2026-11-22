'use client';

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
  formatDate,
  type DataTableColumn,
} from '@casvitta/ui';
import { BackofficePageHeader, Dialog, Textarea } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  can,
  openAuthorizationDocument,
  useAuthorizationQueue,
  useDecideAuthorization,
  useStaffMe,
  type AuthorizationItem,
} from '@/lib/data/staff';

import { formatToday } from './format';

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** BO6 · Conferência de autorizações (CRM mockup 04: "Conferência da autorização pela Casvitta"). */
export function AuthorizationsScreen() {
  const t = useTranslations('backoffice.authorizations');
  const tStates = useTranslations('backoffice.states');
  const tShell = useTranslations('backoffice.shell');
  const allowed = can(useStaffMe().data, 'listings.moderate');
  const queue = useAuthorizationQueue(allowed);
  const decide = useDecideAuthorization();
  const [rejecting, setRejecting] = useState<AuthorizationItem | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const columns: DataTableColumn<AuthorizationItem>[] = [
    {
      key: 'property',
      header: t('columns.property'),
      cell: (a) => (
        <div className="flex flex-col">
          <span className="font-semibold">
            {a.property_code} · {a.property_title}
          </span>
          <span className="type-caption">
            {a.neighborhood}, {a.city}
          </span>
          {a.waiting_listings > 0 ? (
            <StatusPill tone="attention" className="mt-1 self-start">
              {t('waiting', { count: a.waiting_listings })}
            </StatusPill>
          ) : null}
          {a.is_demo ? (
            <Badge variant="demo" className="mt-1 self-start">
              {tShell('demo')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'broker',
      header: t('columns.broker'),
      cell: (a) => (
        <span className="type-body-s">
          {a.broker_name ?? '—'}
          <span className="block type-caption">{a.workspace_name}</span>
        </span>
      ),
    },
    {
      key: 'authorization',
      header: t('columns.authorization'),
      cell: (a) => (
        <span className="type-body-s">
          {t(`evidence.${a.evidence}`)}
          {a.exclusive ? ` · ${t('exclusive')}` : ''}
          <span className="block type-caption">{t('owner', { name: a.owner_name })}</span>
          <span className="block type-caption">
            {t('validity', { signed: day(a.signed_at), expires: day(a.expires_at) })}
          </span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      cell: (a) => (
        <div className="flex flex-wrap gap-2">
          {a.has_document ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openAuthorizationDocument(a.id).catch(() => setError(t('error')))}
            >
              {t('openDocument')}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              setRejecting(a);
            }}
          >
            {t('reject')}
          </Button>
          <Button
            size="sm"
            loading={decide.isPending && decide.variables?.id === a.id}
            onClick={() =>
              decide.mutateAsync({ id: a.id, outcome: 'verify' }).catch(() => setError(t('error')))
            }
          >
            {t('verify')}
          </Button>
        </div>
      ),
    },
  ];

  const submitReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    try {
      await decide.mutateAsync({ id: rejecting.id, outcome: 'reject', reason });
      setRejecting(null);
      setReason('');
    } catch {
      setError(t('error'));
    }
  };

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <Panel title={t('checklistTitle')} className="mb-5">
        <p className="type-body-s text-fg-strong">{t('checklist')}</p>
      </Panel>
      {!allowed ? (
        <p className="type-body text-fg-muted">{tStates('forbidden')}</p>
      ) : queue.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : queue.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => queue.refetch()}>{tStates('retry')}</Button>}
        />
      ) : queue.data.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <DataTable caption={t('title')} columns={columns} rows={queue.data} rowKey={(a) => a.id} />
      )}
      {error && !rejecting ? <p className="mt-3 type-body-s text-danger">{error}</p> : null}
      {rejecting ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setRejecting(null)}
          title={t('rejectTitle', { code: rejecting.property_code })}
          description={t('rejectDescription')}
          closeLabel={t('cancel')}
        >
          <form onSubmit={submitReject} className="flex flex-col gap-4">
            <Textarea
              label={t('reason')}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error ? <p className="type-body-s text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" loading={decide.isPending}>
                {t('confirmReject')}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
