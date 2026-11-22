'use client';

import { Button, Callout, Panel, StatusPill, cn, formatBRL, formatDate } from '@casvitta/ui';
import { Dialog } from '@casvitta/ui/backoffice';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { PAID_PLANS, type CatalogPlan } from '@/config/catalog';
import { CrmError } from '@/lib/data/crm';
import {
  useBillingPortal,
  useCancelRequest,
  useCheckout,
  useDowngrade,
  usePlan,
  useRequestPlan,
  useResume,
  type PaidPlan,
  type PlanUsage,
} from '@/lib/data/plan';
import { formatNumber } from '@/lib/format';

type Confirm = { kind: 'change'; plan: PaidPlan } | { kind: 'downgrade' };

const when = (iso: string | null | undefined) => (iso ? formatDate(new Date(iso)) : '—');
const price = (cents: number) => formatBRL(cents).replace(/,00$/, '');

/** Plano e uso (docs/mockups/crm/17, plan part): current plan, meters, plans and payment. */
export function PlanScreen() {
  const t = useTranslations('planUsage');
  const tNames = useTranslations('plans.names');
  const params = useSearchParams();
  const router = useRouter();
  const returned = params.get('pagamento'); // ok | cancelado (back from Stripe Checkout)
  const usage = usePlan(returned === 'ok');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = useCheckout();
  const request = useRequestPlan();
  const cancelRequest = useCancelRequest();
  const downgrade = useDowngrade();
  const resume = useResume();
  const portal = useBillingPortal();
  const waiting = usage.data?.open_request?.status === 'awaiting_payment';

  const fail = (e: unknown) =>
    setError(e instanceof CrmError && e.message ? e.message : t('error'));
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    if (returned) router.replace('/plano'); // the Stripe return message is about the past now
    try {
      await action();
      setConfirm(null);
    } catch (e) {
      fail(e);
    }
  };

  if (usage.isPending) {
    return (
      <p role="status" className="type-body text-fg-muted">
        {t('loading')}
      </p>
    );
  }
  if (usage.isError || !usage.data) return <Callout tone="attention">{t('loadError')}</Callout>;

  const data = usage.data;
  const sub = data.subscription ?? null;
  const confirming = returned === 'ok' && waiting;
  const choose = (plan: PaidPlan) => {
    if (!data.billing_enabled) return run(() => request.mutateAsync(plan));
    if (sub) return setConfirm({ kind: 'change', plan });
    return run(() => checkout.mutateAsync(plan));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div role="status" aria-live="polite" className="empty:hidden">
        {returned === 'ok' ? (
          <Callout tone="info">
            {confirming ? t('return.confirming') : t('return.ok', { plan: tNames(data.plan) })}
          </Callout>
        ) : returned === 'cancelado' ? (
          <Callout tone="info">{t('return.cancelled')}</Callout>
        ) : null}
      </div>
      {error ? (
        <div role="alert">
          <Callout tone="risk">{error}</Callout>
        </div>
      ) : null}

      <CurrentPlan
        data={data}
        onPortal={() => run(() => portal.mutateAsync())}
        onResume={() => run(() => resume.mutateAsync())}
        onDowngrade={() => setConfirm({ kind: 'downgrade' })}
        busy={portal.isPending || resume.isPending}
      />

      <Meters data={data} />

      <Panel title={t('plans.title')}>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PAID_PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              data={data}
              busy={checkout.isPending || request.isPending}
              onChoose={() => choose(plan.key as PaidPlan)}
              onCancelRequest={(id) => run(() => cancelRequest.mutateAsync(id))}
            />
          ))}
        </ul>
        <p className="mt-4 type-caption text-fg-muted">
          {data.billing_enabled ? t('plans.noteCard') : t('plans.noteRequest')}
        </p>
        <p className="mt-1 type-caption text-fg-muted">{t('plans.noteMedia')}</p>
      </Panel>

      {confirm ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={
            confirm.kind === 'change'
              ? t('confirmChange.title', { plan: tNames(confirm.plan) })
              : t('confirmDowngrade.title')
          }
          description={
            confirm.kind === 'change'
              ? t('confirmChange.description')
              : sub
                ? t('confirmDowngrade.withSubscription', { date: when(sub.current_period_end) })
                : t('confirmDowngrade.now')
          }
          closeLabel={t('cancel')}
        >
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
              {t('cancel')}
            </Button>
            {confirm.kind === 'change' ? (
              <Button
                loading={checkout.isPending}
                onClick={() => run(() => checkout.mutateAsync(confirm.plan))}
              >
                {t('confirmChange.confirm', { plan: tNames(confirm.plan) })}
              </Button>
            ) : (
              <Button
                variant="danger"
                loading={downgrade.isPending}
                onClick={() => run(() => downgrade.mutateAsync())}
              >
                {t('confirmDowngrade.confirm')}
              </Button>
            )}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function CurrentPlan({
  data,
  onPortal,
  onResume,
  onDowngrade,
  busy,
}: {
  data: PlanUsage;
  onPortal: () => void;
  onResume: () => void;
  onDowngrade: () => void;
  busy: boolean;
}) {
  const t = useTranslations('planUsage.current');
  const tNames = useTranslations('plans.names');
  const sub = data.subscription ?? null;
  const spec = PAID_PLANS.find((p) => p.key === data.plan);
  return (
    <Panel title={t('title')}>
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-h3">{tNames(data.plan)}</span>
          {spec ? (
            <span className="font-mono tabular type-body">
              {t('price', { price: price(spec.monthly_cents) })}
            </span>
          ) : null}
          {sub?.payment_failed ? (
            <StatusPill tone="danger">{t('paymentFailedPill')}</StatusPill>
          ) : sub?.cancel_at_period_end ? (
            <StatusPill tone="attention">{t('endingPill')}</StatusPill>
          ) : sub ? (
            <StatusPill tone="success">{t('activePill')}</StatusPill>
          ) : null}
        </p>
        {sub?.payment_failed ? (
          <Callout tone="risk">{t('paymentFailed')}</Callout>
        ) : sub?.cancel_at_period_end ? (
          <Callout tone="attention">{t('ending', { date: when(sub.current_period_end) })}</Callout>
        ) : sub ? (
          <p className="type-body-s text-fg-muted">
            {t('renews', { date: when(sub.current_period_end) })}
          </p>
        ) : data.plan !== 'free' ? (
          <p className="type-body-s text-fg-muted">{t('assigned')}</p>
        ) : (
          <p className="type-body-s text-fg-muted">{t('free')}</p>
        )}
        {data.legacy ? <p className="type-body-s text-fg-muted">{t('legacy')}</p> : null}
        <div className="flex flex-wrap gap-2">
          {sub ? (
            <Button variant="secondary" onClick={onPortal} loading={busy}>
              {t('portal')}
            </Button>
          ) : null}
          {sub?.cancel_at_period_end ? (
            <Button onClick={onResume} loading={busy}>
              {t('resume')}
            </Button>
          ) : data.plan !== 'free' ? (
            <Button variant="ghost" onClick={onDowngrade}>
              {t('downgrade')}
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function Meters({ data }: { data: PlanUsage }) {
  const t = useTranslations('planUsage.meters');
  const tRows = useTranslations('audience.plans.table.rows');
  const measured = data.meters.filter((m) => m.used !== null && m.state !== 'not_included');
  if (measured.length === 0) return null;
  return (
    <Panel title={t('title')}>
      <ul className="flex flex-col gap-4">
        {measured.map((m) => {
          const used = m.used ?? 0;
          const pct = m.limit ? Math.min(100, Math.round((used / m.limit) * 100)) : 0;
          return (
            <li key={m.meter} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 type-body-s">
                <span>{tRows(m.meter)}</span>
                <span className="font-mono tabular font-semibold whitespace-nowrap">
                  {m.limit === null
                    ? t('unlimited', { used: formatNumber(used) })
                    : t('of', { used: formatNumber(used), limit: formatNumber(m.limit) })}
                </span>
              </div>
              {m.limit !== null ? (
                <div
                  className="h-2 rounded-pill bg-subtle"
                  role="progressbar"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={m.limit}
                  aria-label={tRows(m.meter)}
                >
                  <div
                    className={cn(
                      'h-full rounded-pill',
                      m.state === 'reached'
                        ? 'bg-danger'
                        : m.state === 'warning'
                          ? 'bg-attention'
                          : 'bg-action',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
              {m.state === 'warning' || m.state === 'reached' ? (
                <span className="type-caption text-fg-muted">{t(m.state)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function PlanCard({
  plan,
  data,
  busy,
  onChoose,
  onCancelRequest,
}: {
  plan: CatalogPlan;
  data: PlanUsage;
  busy: boolean;
  onChoose: () => void;
  onCancelRequest: (id: string) => void;
}) {
  const t = useTranslations('planUsage.plans');
  const tPlans = useTranslations('plans');
  const tNames = useTranslations('plans.names');
  const sub = data.subscription ?? null;
  const current = data.plan === plan.key;
  const requested = data.open_request?.requested_plan === plan.key ? data.open_request : null;
  const properties = plan.limits.active_properties;
  const conversations = plan.limits.ai_conversations_month;
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-card border p-4',
        current ? 'border-action' : 'border-line',
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="type-body font-semibold">{tNames(plan.key)}</span>
        <span className="font-mono tabular type-body">
          {plan.price_from ? `${tPlans('from')} ` : ''}
          {price(plan.monthly_cents)}
          {tPlans('perMonth')}
        </span>
      </div>
      <ul className="flex flex-col gap-1 type-body-s text-fg-muted">
        <li>{tPlans('users', { count: plan.limits.users ?? 1 })}</li>
        {properties ? <li>{tPlans('properties', { count: formatNumber(properties) })}</li> : null}
        <li>
          {conversations
            ? tPlans('aiConversations', { count: formatNumber(conversations) })
            : tPlans('noAutomation')}
        </li>
      </ul>
      <div className="mt-auto flex flex-col gap-2">
        {current ? (
          <Button variant="secondary" disabled>
            {t('current')}
          </Button>
        ) : requested && !data.billing_enabled ? (
          <>
            <p className="type-caption text-fg-muted">{t('requested')}</p>
            <Button variant="ghost" onClick={() => onCancelRequest(requested.id)}>
              {t('cancelRequest')}
            </Button>
          </>
        ) : (
          <Button
            variant={sub ? 'secondary' : 'primary'}
            onClick={onChoose}
            loading={busy}
            disabled={sub?.payment_failed}
          >
            {!data.billing_enabled
              ? t('request', { plan: tNames(plan.key) })
              : sub
                ? t('change', { plan: tNames(plan.key) })
                : t('subscribe', { plan: tNames(plan.key) })}
          </Button>
        )}
      </div>
    </li>
  );
}
