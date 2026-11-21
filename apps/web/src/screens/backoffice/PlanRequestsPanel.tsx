'use client';

import { Button, EmptyState, ErrorState, LoadingState, Panel, StatusPill } from '@casvitta/ui';
import { Dialog, Textarea } from '@casvitta/ui/backoffice';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  can,
  useDecidePlanRequest,
  usePlanRequests,
  useStaffMe,
  type PlanRequest,
} from '@/lib/data/staff';

import { formatDayTime } from './format';

/**
 * Pedidos de plano e pacotes (CRM-0). Billing is off: staff assign the plan by hand, audited.
 * Only roles with "billing.manage" see and act on the queue.
 */
export function PlanRequestsPanel() {
  const t = useTranslations('backoffice.planRequests');
  const tPlans = useTranslations('backoffice.plans');
  const tStates = useTranslations('backoffice.states');
  const allowed = can(useStaffMe().data, 'billing.manage');
  const requests = usePlanRequests(allowed);
  const decide = useDecidePlanRequest();
  const [declining, setDeclining] = useState<PlanRequest | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!allowed) return null;

  const what = (r: PlanRequest) =>
    r.kind === 'plan' && r.requested_plan
      ? t('toPlan', { from: tPlans(r.current_plan), to: tPlans(r.requested_plan) })
      : t('addOn', { name: t(`addOns.${r.add_on_key ?? 'unknown'}` as 'addOns.unknown') });

  const submitDecline = async (e: FormEvent) => {
    e.preventDefault();
    if (!declining) return;
    try {
      await decide.mutateAsync({ id: declining.id, outcome: 'decline', reason });
      setDeclining(null);
      setReason('');
    } catch {
      setError(t('error'));
    }
  };

  return (
    <Panel title={t('title')} className="mb-5">
      <p className="mb-3 type-body-s text-fg-muted">{t('description')}</p>
      {requests.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : requests.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => requests.refetch()}>{tStates('retry')}</Button>}
        />
      ) : requests.data.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {requests.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-col">
                <span className="font-semibold">{r.workspace_name}</span>
                <span className="type-body-s text-fg-strong">{what(r)}</span>
                <span className="type-caption">
                  {t('meta', {
                    when: formatDayTime(r.created_at),
                    source: t(`sources.${r.source}`),
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {r.billing_period === 'annual' ? (
                  <StatusPill tone="neutral">{t('annual')}</StatusPill>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setDeclining(r);
                  }}
                >
                  {t('decline')}
                </Button>
                <Button
                  loading={decide.isPending && decide.variables?.id === r.id}
                  onClick={() =>
                    decide
                      .mutateAsync({ id: r.id, outcome: 'approve' })
                      .catch(() => setError(t('error')))
                  }
                >
                  {t('approve')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && !declining ? <p className="mt-2 type-body-s text-danger">{error}</p> : null}
      {declining ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setDeclining(null)}
          title={t('declineTitle', { name: declining.workspace_name })}
          description={t('declineDescription')}
          closeLabel={t('close')}
        >
          <form onSubmit={submitDecline} className="flex flex-col gap-4">
            <Textarea
              label={t('reason')}
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error ? <p className="type-body-s text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setDeclining(null)}>
                {t('close')}
              </Button>
              <Button type="submit" loading={decide.isPending}>
                {t('confirmDecline')}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </Panel>
  );
}
