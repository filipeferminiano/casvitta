'use client';

import {
  Badge,
  Button,
  Callout,
  DataTable,
  EmptyState,
  ErrorState,
  KeyValueList,
  LoadingState,
  Panel,
  StatusPill,
  filterChipClass,
  formatDate,
  type DataTableColumn,
} from '@casvitta/ui';
import { BackofficePageHeader, Dialog, Textarea } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  can,
  usePageAction,
  useStaffMe,
  useStaffPage,
  useStaffPages,
  type PageAction,
  type StaffPageRow,
  type StaffPagesTab,
} from '@/lib/data/staff';

import { formatToday } from './format';

const TABS: StaffPagesTab[] = ['review', 'published', 'suspended'];
const when = (iso: string | null | undefined) => (iso ? formatDate(new Date(iso)) : '—');

type Pending = { action: PageAction['kind']; pageId?: string; reportId?: string; title: string };

/** Casvitta Social · Páginas e domínios (docs/mockups/social/31). Domains come with SOC-1b.5. */
export function PagesScreen() {
  const t = useTranslations('backoffice.pages');
  const tStates = useTranslations('backoffice.states');
  const tShell = useTranslations('backoffice.shell');
  const canAct = can(useStaffMe().data, 'listings.moderate');
  const [tab, setTab] = useState<StaffPagesTab>('review');
  const [selected, setSelected] = useState<string | null>(null);
  const queue = useStaffPages(tab);
  const detail = useStaffPage(selected);
  const act = usePageAction();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const signal = (p: StaffPageRow) =>
    p.signal === 'report'
      ? t(`reasons.${p.signal_reason ?? 'other'}`)
      : p.signal === 'creci_unverified'
        ? t('signals.creci_unverified')
        : null;

  const columns: DataTableColumn<StaffPageRow>[] = [
    {
      key: 'signal',
      header: t('columns.signal'),
      cell: (p) =>
        p.signal ? (
          <StatusPill tone={p.signal === 'report' ? 'danger' : 'attention'}>
            {p.signal === 'report' ? t('signals.report') : t('signals.creciShort')}
          </StatusPill>
        ) : (
          <StatusPill tone={p.status === 'suspended' ? 'danger' : 'success'}>
            {t(`status.${p.status}`)}
          </StatusPill>
        ),
    },
    {
      key: 'page',
      header: t('columns.page'),
      cell: (p) => (
        <button
          type="button"
          onClick={() => setSelected(p.page_id)}
          aria-current={selected === p.page_id ? 'true' : undefined}
          className="hit-area-44 flex flex-col text-left focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="font-mono font-semibold underline-offset-4 hover:underline">
            {p.slug}
          </span>
          <span className="type-caption">{p.display_name}</span>
          {p.is_demo ? (
            <Badge variant="demo" className="mt-1 self-start">
              {tShell('demo')}
            </Badge>
          ) : null}
        </button>
      ),
    },
    {
      key: 'detail',
      header: t('columns.detail'),
      cell: (p) => (
        <span className="type-body-s">
          {signal(p) ?? t(`plans.${p.plan}`)}
          {p.signal_text ? <span className="block type-caption">“{p.signal_text}”</span> : null}
          {p.suspended_reason ? (
            <span className="block type-caption">{p.suspended_reason}</span>
          ) : null}
        </span>
      ),
    },
    { key: 'at', header: t('columns.at'), cell: (p) => when(p.signal_at ?? p.published_at) },
  ];

  const open = (p: Pending) => {
    setError(null);
    setReason('');
    setPending(p);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    if (reason.trim().length < 5) return setError(t('needReason'));
    const a: PageAction =
      pending.action === 'dismiss'
        ? { kind: 'dismiss', reportId: pending.reportId as string, reason }
        : { kind: pending.action, pageId: pending.pageId as string, reason };
    try {
      await act.mutateAsync(a);
      setPending(null);
    } catch {
      setError(t('error'));
    }
  };

  const d = detail.data;
  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <nav aria-label={t('title')} className="mb-4 flex flex-wrap gap-2">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={filterChipClass(tab === key)}
            onClick={() => {
              setTab(key);
              setSelected(null);
            }}
          >
            {t(`tabs.${key}`)} · {queue.data?.counts[key] ?? '…'}
          </button>
        ))}
        <span className={filterChipClass(false)}>
          {t('tabs.reports')} · {queue.data?.counts.reports ?? '…'}
        </span>
      </nav>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          {queue.isPending ? (
            <LoadingState title={tStates('loading', { subject: t('subject') })} />
          ) : queue.isError ? (
            <ErrorState
              title={tStates('errorTitle', { subject: t('subject') })}
              stillWorks={tStates('errorStillWorks')}
              howToFix={tStates('errorHowToFix')}
              primaryAction={<Button onClick={() => queue.refetch()}>{tStates('retry')}</Button>}
            />
          ) : queue.data.items.length === 0 ? (
            <EmptyState title={t(`empty.${tab}`)} />
          ) : (
            <DataTable
              caption={t(`tabs.${tab}`)}
              columns={columns}
              rows={queue.data.items}
              rowKey={(p) => p.page_id}
            />
          )}
        </div>
        <div>
          {!selected ? (
            <Panel title={t('detailTitle')}>
              <p className="type-body-s text-fg-muted">{t('pickOne')}</p>
            </Panel>
          ) : !d ? (
            <LoadingState title={tStates('loading', { subject: t('subject') })} />
          ) : (
            <Panel title={d.page.url.replace(/^https?:\/\//, '')}>
              <div className="flex flex-col gap-4">
                <KeyValueList
                  rows={[
                    { key: 'broker', label: t('fields.broker'), value: d.page.display_name },
                    {
                      key: 'creci',
                      label: t('fields.creci'),
                      value: d.page.creci_verified ? t('creciOk') : t('creciPending'),
                    },
                    { key: 'plan', label: t('fields.plan'), value: t(`plans.${d.page.plan}`) },
                    {
                      key: 'status',
                      label: t('fields.status'),
                      value: t(`status.${d.page.status}`),
                    },
                    {
                      key: 'published',
                      label: t('fields.published'),
                      value: when(d.page.published_at),
                    },
                    {
                      key: 'properties',
                      label: t('fields.properties'),
                      value: d.page.creci_verified
                        ? String(d.visible_properties)
                        : t('propertiesHidden', { n: d.visible_properties }),
                    },
                    { key: 'visits', label: t('fields.visits'), value: String(d.visits_24h) },
                  ]}
                />
                {d.reports.length ? (
                  <section aria-labelledby="reports-title" className="flex flex-col gap-2">
                    <h3 id="reports-title" className="type-body font-semibold">
                      {t('reportsTitle')}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {d.reports.map((r) => (
                        <li key={r.id} className="rounded-card border border-line p-3 type-body-s">
                          <span className="font-semibold">{t(`reasons.${r.reason}`)}</span> ·{' '}
                          {when(r.created_at)} · {t(`reportStatus.${r.status}`)}
                          {r.details ? <span className="block">“{r.details}”</span> : null}
                          {r.review_note ? (
                            <span className="block type-caption">{r.review_note}</span>
                          ) : null}
                          {r.status === 'open' && canAct ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="mt-2"
                              onClick={() =>
                                open({
                                  action: 'dismiss',
                                  reportId: r.id,
                                  title: t('dismissTitle'),
                                })
                              }
                            >
                              {t('dismiss')}
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {canAct ? (
                  <div className="flex flex-wrap gap-2">
                    {d.page.status === 'suspended' ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          open({
                            action: 'reactivate',
                            pageId: d.page.page_id,
                            title: t('reactivateTitle', { slug: d.page.slug }),
                          })
                        }
                      >
                        {t('reactivate')}
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={() =>
                          open({
                            action: 'suspend',
                            pageId: d.page.page_id,
                            title: t('suspendTitle', { slug: d.page.slug }),
                          })
                        }
                      >
                        {t('suspend')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="type-caption">{tStates('forbidden')}</p>
                )}
                <Callout tone="info">{t('privacy')}</Callout>
              </div>
            </Panel>
          )}
        </div>
      </div>
      {pending ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={pending.title}
          description={t(`dialog.${pending.action}`)}
          closeLabel={t('cancel')}
        >
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Textarea
              label={t('reason')}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error ? (
              <p role="alert" className="type-body-s text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPending(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant={pending.action === 'suspend' ? 'danger' : 'primary'}
                loading={act.isPending}
              >
                {t(`confirm.${pending.action}`)}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
