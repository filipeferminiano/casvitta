'use client';

import {
  Button,
  Callout,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
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

/** BO7 · Receita (docs/mockups/backoffice/07-revenue). Liga depois: no amounts until billing. */
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
      key: 'status',
      header: t('columns.status'),
      cell: (l) => <StatusPill tone="neutral">{t(`status.${l.status}`)}</StatusPill>,
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
