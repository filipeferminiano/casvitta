'use client';

import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
  Tabs,
  TabsList,
  TabsTrigger,
  formatDate,
  useToast,
} from '@casvitta/ui';
import {
  BackofficePageHeader,
  Dialog,
  QueueTable,
  Textarea,
  type QueueColumn,
} from '@casvitta/ui/backoffice';
import { ExternalLink } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import {
  can,
  useCreciQueue,
  useDecideCreci,
  useStaffMe,
  type CreciChecklist,
  type CreciItem,
  type CreciTab,
} from '@/lib/data/staff';
import { StaffApiError } from '@/lib/staff-api';

import { formatToday } from './format';

const TABS: CreciTab[] = ['pending', 'correction_requested', 'verified', 'rejected'];
const CHECKS: (keyof CreciChecklist)[] = [
  'number_exists',
  'name_matches',
  'active',
  'kind_matches',
];
const NO_CHECKS: CreciChecklist = {
  number_exists: false,
  name_matches: false,
  active: false,
  kind_matches: false,
};

function isTab(value: string | null): value is CreciTab {
  return value !== null && (TABS as string[]).includes(value);
}

export function waitingTone(item: CreciItem, slaHours: number): 'danger' | 'attention' | 'success' {
  if (item.over_sla) return 'danger';
  return item.waiting_hours >= slaHours / 4 ? 'attention' : 'success';
}

/** BO2 · Verificação de CRECI (docs/mockups/backoffice/02-creci-verification). */
export function CreciScreen() {
  const t = useTranslations('backoffice.creci');
  const tStates = useTranslations('backoffice.states');
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get('status');
  const tab: CreciTab = isTab(tabParam) ? tabParam : 'pending';
  const queue = useCreciQueue(tab);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('perfil'));

  const items = queue.data?.items ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const setTab = (next: string) => {
    setSelectedId(null);
    router.replace(next === 'pending' ? '/creci' : `/creci?status=${next}`);
  };

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('title')} className="mb-5">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key} count={queue.data?.counts[key]}>
              {t(`tabs.${key}`)}
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
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <CreciTable
              items={items}
              tab={tab}
              slaHours={queue.data.sla_hours}
              selectedId={selected?.id ?? null}
              onSelect={(item) => setSelectedId(item.id)}
            />
            {items.length ? (
              <p className="mt-3 type-caption">
                {tab === 'pending' || tab === 'correction_requested'
                  ? t('footnote')
                  : t('historyFootnote')}
              </p>
            ) : null}
          </div>
          {selected ? (
            <CreciDetail
              key={selected.id}
              item={selected}
              slaHours={queue.data.sla_hours}
              onDone={() => {
                const index = items.findIndex((i) => i.id === selected.id);
                setSelectedId(items[index + 1]?.id ?? items[index - 1]?.id ?? null);
              }}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

function CreciTable({
  items,
  tab,
  slaHours,
  selectedId,
  onSelect,
}: {
  items: CreciItem[];
  tab: CreciTab;
  slaHours: number;
  selectedId: string | null;
  onSelect: (item: CreciItem) => void;
}) {
  const t = useTranslations('backoffice.creci');
  const waiting = tab === 'pending' || tab === 'correction_requested';
  const columns: QueueColumn<CreciItem>[] = [
    {
      key: 'creci',
      header: t('columns.creci'),
      cell: (i) => (
        <span className="whitespace-nowrap">
          CRECI-{i.creci_state} {i.creci_number}
        </span>
      ),
    },
    {
      key: 'kind',
      header: t('columns.kind'),
      cell: (i) => (i.creci_kind ? t(`kind.${i.creci_kind}`) : ''),
    },
    ...(waiting
      ? [
          {
            key: 'waiting',
            header: t('columns.waiting'),
            cell: (i: CreciItem) => (
              <StatusPill tone={waitingTone(i, slaHours)}>
                {t('hours', { hours: i.waiting_hours })}
              </StatusPill>
            ),
          },
        ]
      : []),
    {
      key: 'status',
      header: t('columns.status'),
      cell: (i) => <SituationPill item={i} />,
    },
  ];
  return (
    <QueueTable
      caption={t('title')}
      rows={items}
      rowKey={(i) => i.id}
      selectedKey={selectedId}
      onSelect={onSelect}
      selectLabel={(i) => t('select', { name: i.display_name })}
      primary={{
        key: 'broker',
        header: t('columns.broker'),
        cell: (i) => (
          <>
            <span className="font-semibold text-fg">{i.display_name}</span>
            <span className="type-caption">{[i.email, i.city].filter(Boolean).join(' · ')}</span>
          </>
        ),
      }}
      columns={columns}
      empty={<EmptyState title={t(`empty.${tab}`)} />}
    />
  );
}

function SituationPill({ item }: { item: CreciItem }) {
  const t = useTranslations('backoffice.creci.status');
  switch (item.status) {
    case 'pending':
      return item.resubmitted ? (
        <StatusPill tone="info">{t('resubmitted')}</StatusPill>
      ) : (
        <StatusPill tone="neutral">{t('first')}</StatusPill>
      );
    case 'correction_requested':
      return <StatusPill tone="attention">{t('correction_requested')}</StatusPill>;
    case 'verified':
      return <StatusPill tone="success">{t('verified')}</StatusPill>;
    case 'rejected':
      return <StatusPill tone="danger">{t('rejected')}</StatusPill>;
  }
}

function CreciDetail({
  item,
  slaHours,
  onDone,
}: {
  item: CreciItem;
  slaHours: number;
  onDone: () => void;
}) {
  const t = useTranslations('backoffice.creci');
  const tPlans = useTranslations('backoffice.plans');
  const me = useStaffMe().data;
  const decide = useDecideCreci();
  const toast = useToast();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [checks, setChecks] = useState<CreciChecklist>(NO_CHECKS);
  const [reasonFor, setReasonFor] = useState<'request-correction' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = can(me, 'creci.verify');
  const open = item.status === 'pending';
  const complete = CHECKS.every((c) => checks[c]);
  const state = item.creci_state ?? '';

  // A new item in the panel: bring keyboard and screen-reader users to it.
  useEffect(() => {
    if (document.activeElement?.closest('table')) return; // keep arrows working in the queue
    heading.current?.focus();
  }, []);

  const finish = (key: 'verified' | 'correction_requested' | 'rejected') => {
    toast({ title: t(`done.${key}`, { name: item.display_name }), tone: 'success' });
    onDone();
  };

  const fail = (e: unknown) => {
    const code = e instanceof StaffApiError ? e.code : '';
    setError(
      code === 'checklist_incomplete' || code === 'creci_not_pending'
        ? t(`errors.${code}`)
        : t('errors.generic'),
    );
  };

  const approve = async () => {
    setError(null);
    try {
      await decide.mutateAsync({ id: item.id, outcome: 'approve', checklist: checks });
      finish('verified');
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Panel aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id={headingId}
            ref={heading}
            tabIndex={-1}
            className="type-title text-[22px] focus:outline-none"
          >
            {item.display_name}
          </h2>
          <p className="type-body-s text-fg-muted">
            {t('detail.signedUp', {
              date: formatDate(new Date(item.signed_up_at)).slice(0, 5),
              plan: tPlans(item.plan),
            })}
          </p>
        </div>
        {open ? (
          <StatusPill tone={waitingTone(item, slaHours)}>
            {t('hours', { hours: item.waiting_hours })}
          </StatusPill>
        ) : (
          <SituationPill item={item} />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="type-caption">{t('detail.creciName')}</dt>
          <dd className="type-body-s font-semibold">{item.creci_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="type-caption">{t('detail.number')}</dt>
          <dd className="font-mono type-body-s font-semibold">{item.creci_number}</dd>
        </div>
        <div>
          <dt className="type-caption">{t('detail.state')}</dt>
          <dd className="type-body-s font-semibold">{state}</dd>
        </div>
        <div>
          <dt className="type-caption">{t('detail.kind')}</dt>
          <dd className="type-body-s font-semibold">
            {item.creci_kind ? t(`kind.${item.creci_kind}`) : '—'}
          </dd>
        </div>
      </dl>

      {item.lookup_url ? (
        <Button asChild variant="secondary" className="mt-4 w-full">
          <a href={item.lookup_url} target="_blank" rel="noopener noreferrer">
            {t('detail.lookup', { state })}
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">{t('detail.newTab')}</span>
          </a>
        </Button>
      ) : (
        <p className="mt-4 type-body-s text-fg-muted">{t('detail.lookupMissing', { state })}</p>
      )}

      {item.reason ? (
        <div className="mt-4 rounded-control bg-canvas p-3">
          <p className="type-caption">{t('detail.reason')}</p>
          <p className="type-body-s">{item.reason}</p>
        </div>
      ) : null}

      {open ? (
        <>
          <fieldset className="mt-4 border-t border-line pt-3">
            <legend className="type-body-s font-semibold">{t('detail.checklist')}</legend>
            {CHECKS.map((c) => (
              <Checkbox
                key={c}
                label={t(`detail.checks.${c}`, { state })}
                checked={checks[c]}
                disabled={!allowed}
                onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c]: v === true }))}
                className="border-b border-line last:border-b-0"
              />
            ))}
          </fieldset>
          {allowed ? (
            <div className="mt-4 flex flex-col gap-3">
              <Button
                onClick={approve}
                disabled={!complete}
                loading={decide.isPending && !reasonFor}
                loadingLabel={t('detail.approving')}
                aria-describedby={complete ? undefined : `${headingId}-hint`}
              >
                {t('detail.approve')}
              </Button>
              {!complete ? (
                <p id={`${headingId}-hint`} className="type-caption">
                  {t('detail.approveHint')}
                </p>
              ) : null}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setReasonFor('request-correction')}>
                  {t('detail.correction')}
                </Button>
                <Button variant="danger" onClick={() => setReasonFor('reject')}>
                  {t('detail.reject')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 type-body-s text-fg-muted">{t('detail.noPermission')}</p>
          )}
        </>
      ) : item.status === 'correction_requested' && allowed ? (
        <div className="mt-4">
          <Button variant="danger" onClick={() => setReasonFor('reject')}>
            {t('detail.reject')}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 type-body-s text-danger">
          {error}
        </p>
      ) : null}
      <p className="mt-4 border-t border-line pt-3 type-caption">{t('detail.note')}</p>

      {reasonFor ? (
        <ReasonDialog
          name={item.display_name}
          kind={reasonFor}
          busy={decide.isPending}
          onCancel={() => setReasonFor(null)}
          onSubmit={async (reason) => {
            setError(null);
            try {
              await decide.mutateAsync({ id: item.id, outcome: reasonFor, reason });
              setReasonFor(null);
              finish(reasonFor === 'reject' ? 'rejected' : 'correction_requested');
            } catch (e) {
              setReasonFor(null);
              fail(e);
            }
          }}
        />
      ) : null}
    </Panel>
  );
}

function ReasonDialog({
  name,
  kind,
  busy,
  onCancel,
  onSubmit,
}: {
  name: string;
  kind: 'request-correction' | 'reject';
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const t = useTranslations('backoffice.creci.reasonDialog');
  const [reason, setReason] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length >= 5) onSubmit(reason.trim());
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={t(kind === 'reject' ? 'rejectTitle' : 'correctionTitle', { name })}
      description={t('description')}
      closeLabel={t('close')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Textarea
          label={t('label')}
          help={t('help')}
          required
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            variant={kind === 'reject' ? 'danger' : 'primary'}
            disabled={reason.trim().length < 5}
            loading={busy}
            loadingLabel={t('sending')}
          >
            {t('send')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
