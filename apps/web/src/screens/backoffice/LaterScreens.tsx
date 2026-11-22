'use client';

import {
  Button,
  Callout,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatTile,
  StatusPill,
  Tabs,
  TabsList,
  TabsTrigger,
  formatBRL,
  formatDate,
  type DataTableColumn,
} from '@casvitta/ui';
import { BackofficePageHeader, CheckList, type CheckListItem } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  can,
  useModeration,
  useRevenue,
  useStaffMe,
  type ModerationQueue,
  type RevenueLine,
} from '@/lib/data/staff';

import { formatToday } from './format';

type Check = ModerationQueue['items'][number]['checks'][number];

/** pt-BR line for one automatic check (BO6). */
export function useCheckLabel() {
  const t = useTranslations('backoffice.moderation.checks');
  return (check: Check): string => {
    const d = check.detail as Record<string, string | number>;
    switch (check.key) {
      case 'creci':
        return t('creci');
      case 'authorization':
        if (d.reason === 'missing') return t('authorizationMissing');
        if (d.reason === 'wrong_kind') return t('authorizationWrongKind');
        if (d.reason === 'expired') {
          return t('authorizationExpired', {
            date: formatDate(new Date(`${d.expires_on}T12:00:00Z`)),
          });
        }
        return t('authorization', { date: formatDate(new Date(`${d.expires_on}T12:00:00Z`)) });
      case 'price':
        if (d.few) return t('priceFew', { count: Number(d.count) });
        return t('price', {
          pct: Math.abs(Number(d.pct)),
          direction: Number(d.pct) < 0 ? t('below') : t('above'),
          count: Number(d.count),
          median: formatBRL(Number(d.median_cents)),
        });
      case 'photo_text':
        return check.outcome === 'ok' ? t('photo_text') : t('photoTextReview');
      case 'duplicate':
        return check.outcome === 'ok' ? t('duplicate') : t('duplicateReview');
    }
  };
}

export function useCheckItems() {
  const t = useTranslations('backoffice.moderation.checks');
  const label = useCheckLabel();
  return (checks: Check[]): CheckListItem[] =>
    checks.map((c) => ({
      key: c.key,
      label: label(c),
      outcome: c.outcome,
      outcomeLabel: t(`outcome.${c.outcome}`),
    }));
}

/** BO6 · Moderação de anúncios (docs/mockups/backoffice/06-listing-moderation). Liga depois. */
export function ModerationScreen() {
  const t = useTranslations('backoffice.moderation');
  const tStates = useTranslations('backoffice.states');
  const queue = useModeration();
  const items = useCheckItems();
  const [tab, setTab] = useState('review');

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('title')} className="mb-5">
          {(['review', 'reports', 'highlights', 'paused'] as const).map((k) => (
            <TabsTrigger key={k} value={k} disabled={!queue.data?.enabled}>
              {t(`tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {queue.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : queue.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => queue.refetch()}>{tStates('retry')}</Button>}
        />
      ) : !queue.data.enabled ? (
        <EmptyState title={t('off.title')} description={t('off.description')} />
      ) : queue.data.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="flex flex-col gap-4">
          {queue.data.items.map((item) => (
            <Panel key={item.listing_id} title={item.title}>
              <p className="mb-3 type-body-s text-fg-muted">
                {item.broker_name} · {formatBRL(item.price_cents)}
              </p>
              <CheckList title={t('checks.title')} items={items(item.checks)} />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

/** BO7 · Receita (docs/mockups/backoffice/07-revenue). Amounts only from what Stripe confirmed;
 * test-mode payments are shown apart and never counted. */
export function RevenueScreen() {
  const t = useTranslations('backoffice.revenue');
  const tStates = useTranslations('backoffice.states');
  const me = useStaffMe().data;
  const allowed = can(me, 'billing.manage');
  const revenue = useRevenue(allowed);

  const price = (line: RevenueLine): string => {
    if (line.status === 'soon') return t(`soonNote.${line.key}` as 'soonNote.commission_rent');
    if (line.price_cents === null || line.price_cents === undefined) return t('undefined');
    const value = formatBRL(line.price_cents);
    if (line.per === 'month') {
      return line.price_from
        ? t('perMonthFrom', { price: value })
        : t('perMonth', { price: value });
    }
    return line.per === 'package'
      ? t('perPackage', { price: value })
      : t('perListing', { price: value });
  };

  const columns: DataTableColumn<RevenueLine>[] = [
    {
      key: 'line',
      header: t('columns.line'),
      cell: (l) => (
        <span className="font-semibold">{t(`lines.${l.key}` as 'lines.plan_essential')}</span>
      ),
    },
    { key: 'nature', header: t('columns.nature'), cell: (l) => t(`nature.${l.nature}`) },
    { key: 'price', header: t('columns.price'), cell: (l) => price(l) },
    {
      key: 'subscribers',
      header: t('columns.subscribers'),
      cell: (l) => (l.subscribers === null || l.subscribers === undefined ? '—' : l.subscribers),
    },
    {
      key: 'month',
      header: t('columns.month'),
      cell: (l) => (
        <span className="font-mono tabular">
          {l.month_cents === null || l.month_cents === undefined ? '—' : formatBRL(l.month_cents)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (l) => (
        <StatusPill tone={l.status === 'active' ? 'success' : 'neutral'}>
          {t(`status.${l.status}`)}
        </StatusPill>
      ),
    },
  ];

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <Callout tone="info" className="mb-5">
        {t('notice')}
      </Callout>
      {!allowed ? (
        <p className="type-body text-fg-muted">{tStates('forbidden')}</p>
      ) : revenue.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('title') })} />
      ) : revenue.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('title') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => revenue.refetch()}>{tStates('retry')}</Button>}
        />
      ) : (
        <>
          {!revenue.data.enabled ? <EmptyState title={t('off')} className="mb-5" /> : null}
          {revenue.data.summary ? (
            <RevenueSummaryBlock
              summary={revenue.data.summary}
              months={revenue.data.months ?? []}
              failed={revenue.data.failed ?? []}
            />
          ) : null}
          <Panel title={t('linesTitle')}>
            <DataTable
              caption={t('linesTitle')}
              columns={columns}
              rows={revenue.data.lines}
              rowKey={(l) => l.key}
            />
          </Panel>
        </>
      )}
    </>
  );
}

type RevenueData = NonNullable<ReturnType<typeof useRevenue>['data']>;

function RevenueSummaryBlock({
  summary,
  months,
  failed,
}: {
  summary: NonNullable<RevenueData['summary']>;
  months: NonNullable<RevenueData['months']>;
  failed: NonNullable<RevenueData['failed']>;
}) {
  const t = useTranslations('backoffice.revenue.live');
  const month = (key: string) => {
    const [y, m] = key.split('-');
    return `${m}/${y}`;
  };
  return (
    <div className="mb-5 flex flex-col gap-5">
      {summary.test_received_cents > 0 ? (
        <Callout tone="attention">
          {t('testNotice', { amount: formatBRL(summary.test_received_cents) })}
        </Callout>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          highlighted
          label={t('month')}
          value={formatBRL(summary.month_cents)}
          caption={t('monthCaption', {
            subscriptions: formatBRL(summary.subscriptions_cents),
            listings: formatBRL(summary.listings_cents),
          })}
        />
        <StatTile
          label={t('mrr')}
          value={formatBRL(summary.mrr_cents)}
          caption={t('mrrCaption', { count: summary.active_subscriptions })}
        />
        <StatTile
          attention={summary.failed_cents > 0}
          label={t('failed')}
          value={formatBRL(summary.failed_cents)}
          caption={t('failedCaption', { count: failed.filter((f) => !f.is_test).length })}
        />
        <StatTile
          label={t('churn')}
          value={
            summary.churn_pct === null || summary.churn_pct === undefined
              ? '—'
              : `${String(summary.churn_pct).replace('.', ',')}%`
          }
          caption={t('churnCaption', {
            ended: summary.ended_this_month,
            ending: summary.ending_subscriptions,
          })}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={t('monthsTitle')}>
          <DataTable
            caption={t('monthsTitle')}
            columns={[
              { key: 'month', header: t('columns.month'), cell: (r) => month(r.month) },
              {
                key: 'subs',
                header: t('columns.subscriptions'),
                cell: (r) => (
                  <span className="font-mono tabular">{formatBRL(r.subscriptions_cents)}</span>
                ),
              },
              {
                key: 'listings',
                header: t('columns.listings'),
                cell: (r) => (
                  <span className="font-mono tabular">{formatBRL(r.listings_cents)}</span>
                ),
              },
            ]}
            rows={months}
            rowKey={(r) => r.month}
          />
        </Panel>
        <Panel title={t('failedTitle')}>
          {failed.length ? (
            <DataTable
              caption={t('failedTitle')}
              columns={[
                {
                  key: 'account',
                  header: t('columns.account'),
                  cell: (f) => (
                    <span>
                      {f.workspace_name}
                      {f.is_test ? ` · ${t('test')}` : ''}
                    </span>
                  ),
                },
                {
                  key: 'amount',
                  header: t('columns.amount'),
                  cell: (f) => (
                    <span className="font-mono tabular">{formatBRL(f.amount_cents)}</span>
                  ),
                },
                {
                  key: 'when',
                  header: t('columns.when'),
                  cell: (f) => (f.failed_at ? formatDate(new Date(f.failed_at)) : '—'),
                },
              ]}
              rows={failed}
              rowKey={(f) => f.workspace_id}
            />
          ) : (
            <p className="type-body-s text-fg-muted">{t('noFailed')}</p>
          )}
          <p className="mt-3 type-caption text-fg-muted">{t('failedNote')}</p>
        </Panel>
      </div>
    </div>
  );
}
