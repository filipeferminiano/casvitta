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
  filterChipClass,
  formatBRL,
  formatDate,
  useToast,
  type DataTableColumn,
} from '@casvitta/ui';
import { BackofficePageHeader, Dialog, Textarea } from '@casvitta/ui/backoffice';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  can,
  useAccount,
  useAccountAction,
  useAccounts,
  useAddNote,
  useStaffMe,
  viewAsCustomer,
  type AccountRow,
  type AccountView,
  type Account360,
} from '@/lib/data/staff';

import { PlanRequestsPanel } from './PlanRequestsPanel';
import { auditDetail } from './TeamAuditScreen';
import { formatDayTime, formatToday, useAgo } from './format';
import { isReauthCancelled, useSensitive } from './ReauthProvider';

const VIEWS: AccountView[] = ['all', 'agencies', 'creci_pending', 'no_access', 'paused'];

function isView(v: string | null): v is AccountView {
  return v !== null && (VIEWS as string[]).includes(v);
}

type CreciState = AccountRow['creci'];

function CreciPill({ state }: { state: CreciState }) {
  const t = useTranslations('backoffice.accounts.creci');
  const tone =
    state === 'verified'
      ? 'success'
      : state === 'rejected'
        ? 'danger'
        : state === 'missing'
          ? 'neutral'
          : 'attention';
  return <StatusPill tone={tone}>{t(state)}</StatusPill>;
}

/** BO4 · Corretores e imobiliárias (docs/mockups/backoffice/04-accounts). */
export function AccountsScreen() {
  const t = useTranslations('backoffice.accounts');
  const tPlans = useTranslations('backoffice.plans');
  const tStates = useTranslations('backoffice.states');
  const tShell = useTranslations('backoffice.shell');
  const ago = useAgo();
  const router = useRouter();
  const param = useSearchParams().get('filtro');
  const view: AccountView = isView(param) ? param : 'all';
  const accounts = useAccounts(view);

  const columns: DataTableColumn<AccountRow>[] = [
    {
      key: 'account',
      header: t('columns.account'),
      cell: (a) => (
        <div className="flex flex-col">
          <Link
            href={`/contas/${a.id}`}
            aria-label={t('open', { name: a.name })}
            className="font-semibold text-fg underline-offset-4 hover:underline"
          >
            {a.name}
          </Link>
          <span className="type-caption">
            {[t(`kind.${a.kind}`), a.city, t('members', { count: a.members })]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {a.is_demo ? (
            <Badge variant="demo" className="mt-0.5 self-start">
              {tShell('demo')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    { key: 'plan', header: t('columns.plan'), cell: (a) => tPlans(a.plan) },
    {
      key: 'creci',
      header: t('columns.creci'),
      cell: (a) => (
        <div className="flex flex-col items-start gap-1">
          <CreciPill state={a.creci} />
          {a.publishing_paused ? <StatusPill tone="danger">{t('paused')}</StatusPill> : null}
        </div>
      ),
    },
    {
      key: 'access',
      header: t('columns.access'),
      cell: (a) => ago(a.last_access_at, t('never')),
    },
  ];

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <PlanRequestsPanel />
      <nav aria-label={t('title')} className="mb-5 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === 'all' ? '/contas' : `/contas?filtro=${v}`}
            aria-current={v === view ? 'page' : undefined}
            className={filterChipClass(v === view)}
            onClick={(e) => {
              e.preventDefault();
              router.replace(v === 'all' ? '/contas' : `/contas?filtro=${v}`);
            }}
          >
            {t(`views.${v}`)} ({accounts.data?.counts[v] ?? '…'})
          </Link>
        ))}
      </nav>
      {accounts.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : accounts.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => accounts.refetch()}>{tStates('retry')}</Button>}
        />
      ) : (
        <DataTable
          caption={t('title')}
          columns={columns}
          rows={accounts.data.items}
          rowKey={(a) => a.id}
          empty={<EmptyState title={t('empty')} />}
        />
      )}
      <p className="mt-3 type-caption">{t('laterNote')}</p>
    </>
  );
}

/** BO5 · Conta (visão 360) (docs/mockups/backoffice/05-account-360). */
export function AccountScreen({ id }: { id: string }) {
  const t = useTranslations('backoffice.account');
  const tAccounts = useTranslations('backoffice.accounts');
  const tPlans = useTranslations('backoffice.plans');
  const tStates = useTranslations('backoffice.states');
  const tShell = useTranslations('backoffice.shell');
  const account = useAccount(id);

  if (account.isPending) {
    return <LoadingState title={tStates('loading', { subject: t('subject') })} />;
  }
  if (account.isError) {
    return (
      <ErrorState
        title={tStates('errorTitle', { subject: t('subject') })}
        stillWorks={tStates('errorStillWorks')}
        howToFix={tStates('errorHowToFix')}
        primaryAction={<Button onClick={() => account.refetch()}>{tStates('retry')}</Button>}
      />
    );
  }
  const a = account.data;
  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={a.name}
        description={[
          tAccounts(`kind.${a.kind}`),
          tAccounts('members', { count: a.team.length }),
          t('since', { date: formatDate(new Date(a.created_at)) }),
          a.city,
        ]
          .filter(Boolean)
          .join(' · ')}
        aside={
          <div className="flex gap-2">
            {a.is_demo ? <Badge variant="demo">{tShell('demo')}</Badge> : null}
            {a.publishing_paused_at ? (
              <StatusPill tone="danger">{tAccounts('paused')}</StatusPill>
            ) : null}
          </div>
        }
      />
      <p className="mb-5 rounded-card border border-dashed border-line-dashed bg-panel p-4 type-body-s text-fg-muted">
        {t('kpisLater')}
      </p>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <BillingPanel billing={a.billing ?? null} plan={tPlans(a.plan)} />
          <Panel title={t('timeline.title')}>
            {a.timeline.length ? (
              <ol className="flex flex-col">
                {a.timeline.map((item, i) => (
                  <li
                    key={`${item.occurred_at}-${i}`}
                    className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-t border-line py-2.5 first:border-t-0"
                  >
                    <span className="font-mono type-body-s tabular text-fg-muted">
                      {formatDayTime(item.occurred_at)}
                    </span>
                    <span className="type-body-s">
                      <strong className="font-semibold">{item.actor_name}</strong>{' '}
                      <span className="font-mono text-[13px]">{item.action}</span>{' '}
                      {auditDetail(
                        {
                          ...item,
                          id: '',
                          actor: '',
                          actor_staff_id: null,
                          entity: '',
                          entity_id: null,
                        },
                        {
                          reason: (reason) => t('timeline.reason', { reason }),
                          value: (_k, v) => v,
                        },
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="type-body-s text-fg-muted">{t('timeline.empty')}</p>
            )}
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <ActionsPanel
            id={a.id}
            name={a.name}
            pausedAt={a.publishing_paused_at}
            pausedReason={a.publishing_paused_reason}
          />
          <Panel title={t('team.title')}>
            <ul className="flex flex-col">
              {a.team.map((m) => (
                <li
                  key={`${m.name}-${m.role}`}
                  className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0"
                >
                  <span className="type-body-s">
                    <strong className="font-semibold">{m.name}</strong> ·{' '}
                    {t(`team.roles.${m.role}`)}
                  </span>
                  <CreciPill state={m.creci} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t('adAccounts.title')} dashed>
            <p className="type-body-s text-fg-muted">{t('adAccounts.empty')}</p>
          </Panel>
          <NotesPanel id={a.id} notes={a.notes} />
        </div>
      </div>
    </>
  );
}

function ActionsPanel({
  id,
  name,
  pausedAt,
  pausedReason,
}: {
  id: string;
  name: string;
  pausedAt: string | null | undefined;
  pausedReason: string | null | undefined;
}) {
  const t = useTranslations('backoffice.account');
  const me = useStaffMe().data;
  const sensitive = useSensitive();
  const action = useAccountAction();
  const toast = useToast();
  const [dialog, setDialog] = useState<'viewAs' | 'pause' | 'resume' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewAs = can(me, 'accounts.view_as');
  const moderate = can(me, 'listings.moderate');

  const submit = async (reason: string) => {
    setError(null);
    try {
      if (dialog === 'viewAs') {
        // Open the tab first (in the click's user gesture), then point it at the session URL.
        const tab = window.open('about:blank', '_blank');
        if (!tab) {
          setError(t('errors.popup'));
          return;
        }
        try {
          const url = await sensitive(() => viewAsCustomer(id, reason));
          tab.opener = null;
          tab.location.href = url;
          toast({ title: t('done.viewAs'), tone: 'success' });
        } catch (e) {
          tab.close();
          throw e;
        }
      } else if (dialog) {
        await sensitive(() => action.mutateAsync({ id, action: dialog, reason }));
        toast({ title: t(dialog === 'pause' ? 'done.paused' : 'done.resumed'), tone: 'success' });
      }
      setDialog(null);
    } catch (e) {
      setDialog(null);
      if (!isReauthCancelled(e)) setError(t('errors.generic'));
    }
  };

  return (
    <Panel title={t('actions.title')}>
      <div className="flex flex-col gap-3">
        <Button disabled aria-describedby={`${id}-payment`}>
          {t('actions.paymentLink')}
        </Button>
        <p id={`${id}-payment`} className="-mt-1 type-caption">
          {t('actions.paymentLater')}
        </p>
        {viewAs ? (
          <Button variant="secondary" onClick={() => setDialog('viewAs')}>
            {t('actions.viewAs')}
          </Button>
        ) : null}
        {moderate ? (
          pausedAt ? (
            <>
              <p className="rounded-control bg-danger-subtle p-2 type-body-s">
                {t('actions.paused', {
                  date: formatDate(new Date(pausedAt)),
                  reason: pausedReason ?? '',
                })}
              </p>
              <Button variant="secondary" onClick={() => setDialog('resume')}>
                {t('actions.resume')}
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setDialog('pause')}>
              {t('actions.pause')}
            </Button>
          )
        ) : null}
        {!viewAs && !moderate ? (
          <p className="type-body-s text-fg-muted">{t('actions.noPermission')}</p>
        ) : null}
        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <p className="type-caption">{t('actions.note')}</p>
        {moderate ? <p className="type-caption">{t('actions.pausedLater')}</p> : null}
      </div>
      {dialog ? (
        <AccountReasonDialog
          title={t(`reason.${dialog}Title`, { name })}
          description={t(dialog === 'viewAs' ? 'reason.viewAsDescription' : 'reason.description')}
          danger={dialog === 'pause'}
          busy={action.isPending}
          onCancel={() => setDialog(null)}
          onSubmit={submit}
        />
      ) : null}
    </Panel>
  );
}

function AccountReasonDialog({
  title,
  description,
  danger,
  busy,
  onCancel,
  onSubmit,
}: {
  title: string;
  description: string;
  danger: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const t = useTranslations('backoffice.account.reason');
  const [reason, setReason] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length >= 5) onSubmit(reason.trim());
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      title={title}
      description={description}
      closeLabel={t('close')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Textarea
          label={t('label')}
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
            variant={danger ? 'danger' : 'primary'}
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

function NotesPanel({
  id,
  notes,
}: {
  id: string;
  notes: { id: string; body: string; author: string; created_at: string }[];
}) {
  const t = useTranslations('backoffice.account.notes');
  const me = useStaffMe().data;
  const add = useAddNote();
  const toast = useToast();
  const [body, setBody] = useState('');
  const canWrite = (me?.permissions.length ?? 0) > 0;
  return (
    <Panel title={t('title')}>
      {canWrite ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await add.mutateAsync({ id, body });
            setBody('');
            toast({ title: t('saved'), tone: 'success' });
          }}
        >
          <Textarea label={t('label')} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button
            type="submit"
            variant="secondary"
            disabled={body.trim().length < 2}
            loading={add.isPending}
            loadingLabel={t('saving')}
          >
            {t('save')}
          </Button>
        </form>
      ) : null}
      {notes.length ? (
        <ul className="mt-3 flex flex-col">
          {notes.map((n) => (
            <li key={n.id} className="border-t border-line py-2.5">
              <p className="type-body-s whitespace-pre-line">{n.body}</p>
              <p className="type-caption">
                {t('by', { author: n.author, date: formatDayTime(n.created_at) })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 type-body-s text-fg-muted">{t('empty')}</p>
      )}
    </Panel>
  );
}

type Billing = NonNullable<Account360['billing']>;

/** Assinatura e pagamentos (mockup backoffice/05): what Stripe confirmed. No card data. */
function BillingPanel({ billing, plan }: { billing: Billing | null; plan: string }) {
  const t = useTranslations('backoffice.account.billing');
  const tPlans = useTranslations('backoffice.plans');
  const tAddOns = useTranslations('planUsage.addOns.names');
  if (!billing) {
    return (
      <Panel title={t('title')} aside={<StatusPill tone="info">{t('plan', { plan })}</StatusPill>}>
        <p className="type-body-s text-fg-muted">{t('none')}</p>
      </Panel>
    );
  }
  const failed = billing.status === 'past_due' || billing.payment_failed_at;
  return (
    <Panel title={t('title')}>
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2 type-body-s">
          <strong className="font-semibold">
            {billing.plan ? tPlans(billing.plan) : '—'} ·{' '}
            {t('monthly', { price: formatBRL(billing.monthly_cents) })}
          </strong>
          <StatusPill
            tone={failed ? 'danger' : billing.status === 'active' ? 'success' : 'neutral'}
          >
            {failed ? t('failed') : t(`status.${billing.status}` as 'status.active')}
          </StatusPill>
          {billing.is_test ? <Badge variant="demo">{t('test')}</Badge> : null}
        </p>
        {Object.entries(billing.add_ons).map(([key, qty]) => (
          <p key={key} className="type-body-s text-fg-muted">
            {t('addOn', { name: tAddOns(key as 'ai_conversations_500'), count: qty })}
          </p>
        ))}
        <p className="type-body-s text-fg-muted">
          {billing.cancel_at_period_end
            ? t('ending', {
                date: billing.current_period_end
                  ? formatDate(new Date(billing.current_period_end))
                  : '—',
              })
            : t('renews', {
                date: billing.current_period_end
                  ? formatDate(new Date(billing.current_period_end))
                  : '—',
              })}
        </p>
        {billing.payments.length ? (
          <ul className="flex flex-col">
            {billing.payments.map((p) => (
              <li
                key={`${p.occurred_at}-${p.amount_cents}`}
                className="flex items-center justify-between gap-3 border-t border-line py-2 type-body-s first:border-t-0"
              >
                <span>{formatDate(new Date(p.occurred_at))}</span>
                <span className="font-mono tabular">{formatBRL(p.amount_cents)}</span>
                <span className="text-fg-muted">
                  {t('paid')}
                  {p.is_test ? ` · ${t('test')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body-s text-fg-muted">{t('noPayments')}</p>
        )}
        <p className="type-caption text-fg-muted">{t('note')}</p>
      </div>
    </Panel>
  );
}
