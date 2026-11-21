'use client';

import {
  Button,
  DataTable,
  ErrorState,
  FunnelBars,
  LoadingState,
  Panel,
  StatTile,
  type DataTableColumn,
} from '@casvitta/ui';
import {
  ActivityList,
  BackofficePageHeader,
  QueueList,
  type QueueListItem,
} from '@casvitta/ui/backoffice';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useOverview, useStaffMe, type Overview } from '@/lib/data/staff';

import { formatDayTime, formatToday, messageKey } from './format';
import { BO_PATHS } from './StaffShell';

type CaptureRow = Overview['captures'][number];
type Activity = NonNullable<Overview['activity']>[number];

const QUEUE_HREF: Record<Overview['queue'][number]['key'], string> = {
  creci: BO_PATHS.creci,
  owner_requests: `${BO_PATHS.captures}?tipo=owner_listing&status=sem-corretor`,
  institutional_investors: `${BO_PATHS.captures}?tipo=investor_institutional`,
};

const TZ = 'America/Sao_Paulo';

function greetingKey(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(
      now,
    ),
  );
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

function sameDay(iso: string): boolean {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
  return day.format(new Date(iso)) === day.format(new Date());
}

/** BO1 · Visão geral (docs/mockups/backoffice/01-overview). Only tiles with real data. */
export function OverviewScreen() {
  const t = useTranslations('backoffice');
  const me = useStaffMe().data;
  const overview = useOverview();
  const firstName = me?.name.split(' ')[0] ?? '';

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t(`greeting.${greetingKey()}`, { name: firstName })}
        description={t('overview.description')}
      />
      {overview.isPending ? (
        <LoadingState title={t('states.loading', { subject: t('overview.subject') })} />
      ) : overview.isError ? (
        <ErrorState
          title={t('states.errorTitle', { subject: t('overview.subject') })}
          stillWorks={t('states.errorStillWorks')}
          howToFix={t('states.errorHowToFix')}
          primaryAction={<Button onClick={() => overview.refetch()}>{t('states.retry')}</Button>}
        />
      ) : (
        <OverviewBody data={overview.data} />
      )}
    </>
  );
}

export function OverviewBody({ data }: { data: Overview }) {
  const t = useTranslations('backoffice.overview');
  const tKinds = useTranslations('backoffice.kinds');
  const { tiles } = data;
  const hours = data.creci_sla_hours;

  const queue: QueueListItem[] = data.queue
    .filter((q) => q.count > 0)
    .map((q) => ({
      key: q.key,
      title: t(`queue.${q.key}`),
      description:
        q.key === 'creci'
          ? q.over_sla > 0
            ? t('queue.creciDescription', { count: q.over_sla, hours })
            : t('queue.creciDescriptionOk', { hours })
          : t(`queue.${q.key}Description`),
      count: q.count,
      href: QUEUE_HREF[q.key],
      tone: q.key === 'institutional_investors' ? 'neutral' : 'attention',
    }));

  const captureColumns: DataTableColumn<CaptureRow>[] = [
    { key: 'kind', header: t('captures.kind'), cell: (r) => tKinds(r.kind) },
    { key: 'last', header: t('captures.last7d'), numeric: true, cell: (r) => r.last_7d },
    {
      key: 'confirmed',
      header: t('captures.confirmed'),
      numeric: true,
      cell: (r) => r.confirmed_7d,
    },
    {
      key: 'open',
      header: t('captures.open'),
      numeric: true,
      cell: (r) => (r.open === null ? t('captures.none') : r.open),
    },
  ];

  const first = data.funnel[0]?.count ?? 0;
  const funnel = data.funnel.map((step, i) => {
    const previous = i === 0 ? first : (data.funnel[i - 1]?.count ?? 0);
    const pct = previous > 0 ? Math.round((step.count / previous) * 100) : 0;
    return {
      key: step.key,
      label: t(`funnel.steps.${step.key}`),
      value: step.count,
      display: (
        <span className="inline-flex gap-3">
          <span>{step.count}</span>
          <span className="w-10 font-normal text-fg-muted">{pct}%</span>
        </span>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          label={t('tiles.brokers')}
          value={tiles.brokers_total}
          caption={t('tiles.brokersCaption', { count: tiles.brokers_this_week })}
        />
        <StatTile
          label={t('tiles.creci')}
          value={tiles.creci_pending}
          attention={tiles.creci_pending > 0}
          caption={t('tiles.creciCaption', { count: tiles.creci_pending_over_sla, hours })}
        />
        <StatTile
          label={t('tiles.captures')}
          value={tiles.captures_7d}
          caption={t('tiles.capturesCaption', { count: tiles.captures_7d_auction })}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Panel title={t('queue.title')}>
            {queue.length ? (
              <QueueList
                items={queue}
                openLabel={t('queue.open')}
                linkLabel={(item) =>
                  t('queue.openLabel', { title: String(item.title), count: item.count })
                }
                linkAs={Link}
              />
            ) : (
              <p className="type-body text-fg-muted">{t('queue.empty')}</p>
            )}
          </Panel>
          <Panel
            title={t('captures.title')}
            aside={
              <Link
                href={BO_PATHS.captures}
                className="type-body-s font-semibold text-action underline"
              >
                {t('captures.all')}
              </Link>
            }
          >
            <DataTable
              caption={t('captures.title')}
              columns={captureColumns}
              rows={data.captures}
              rowKey={(r) => r.kind}
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <Panel
            title={t('funnel.title')}
            aside={<span className="type-caption">{t('funnel.since')}</span>}
          >
            <FunnelBars label={t('funnel.title')} items={funnel} caption={t('funnel.caption')} />
          </Panel>
          {data.activity ? (
            <Panel
              title={t('activity.title')}
              aside={
                <Link
                  href={BO_PATHS.team}
                  className="type-body-s font-semibold text-action underline"
                >
                  {t('activity.link')}
                </Link>
              }
            >
              {data.activity.length ? (
                <ActivityList
                  items={data.activity.map((a, i) => ({
                    key: `${a.occurred_at}-${i}`,
                    time: sameDay(a.occurred_at)
                      ? (formatDayTime(a.occurred_at).split(' ')[1] ?? '')
                      : t('activity.yesterday'),
                    actor: a.actor_name,
                    text: <ActivityText item={a} />,
                  }))}
                />
              ) : (
                <p className="type-body-s text-fg-muted">{t('activity.empty')}</p>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const KNOWN = new Set([
  'creci_verified',
  'broker_profile_creci_verified',
  'creci_correction_requested',
  'creci_rejected',
  'interest_assigned',
  'interest_exported',
  'contact_revealed',
  'staff_invited',
  'staff_updated',
  'staff_bootstrapped',
  'staff_added_by_script',
  'audit_exported',
  'account_publishing_paused',
  'account_publishing_resumed',
  'account_viewed_as',
  'account_note_added',
  'interest_handled',
  'interest_assignment_expired',
  'interest_accepted',
]);

function ActivityText({ item }: { item: Activity }) {
  const t = useTranslations('backoffice.overview.activity.actions');
  const key = messageKey(item.action);
  const values = Object.fromEntries(
    Object.entries(item.details).map(([k, v]) => [k, typeof v === 'object' ? '' : String(v)]),
  );
  return <>{KNOWN.has(key) ? t(key, values) : t('other', { action: item.action })}</>;
}
