/**
 * Plano e uso: the current plan, meters and paying through Stripe (cards only). With billing off
 * (`billing_enabled` false in the usage) a paid plan is a request that staff assign.
 */
import type { components } from '@casvitta/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

import { CrmError } from './crm';

type S = components['schemas'];
export type PlanUsage = S['PlanUsageOut'];
export type CheckoutResult = S['CheckoutOut'];
export type PaidPlan = S['CheckoutIn']['plan'];

type Result<T> = { data?: T; error?: unknown; response: Response };

function check<T>(result: Result<T>): T {
  if (result.error !== undefined || !result.response.ok) {
    const body = result.error as { error?: { code?: string; message?: string } } | undefined;
    throw new CrmError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? '',
      result.response.status,
    );
  }
  return result.data as T;
}

const KEY = ['plan'] as const;

/** `poll`: back from Stripe Checkout, refetch every 2 s while the payment is being confirmed
 * (until the webhook lands). */
export function usePlan(poll = false) {
  return useQuery({
    queryKey: [...KEY, 'usage'],
    queryFn: async () => check(await api.GET('/v1/me/plan')),
    refetchInterval: (query) =>
      poll && query.state.data?.open_request?.status === 'awaiting_payment' ? 2000 : false,
  });
}

function useInvalidate() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: KEY }),
      client.invalidateQueries({ queryKey: ['page'] }),
    ]);
}

/** Paid plan: Stripe Checkout (redirect), or a prorated change with a subscription. */
export function useCheckout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (plan: PaidPlan) =>
      check(await api.POST('/v1/me/plan/checkout', { body: { plan, source: 'plans_page' } })),
    onSuccess: async (out) => {
      if (out.result === 'checkout' && out.url) {
        window.location.assign(out.url);
        return;
      }
      await invalidate();
    },
  });
}

/** Billing off: ask staff for the plan (audited in the backoffice). */
export function useRequestPlan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (plan: PaidPlan) =>
      check(
        await api.POST('/v1/me/plan/requests', {
          body: {
            kind: 'plan',
            requested_plan: plan,
            billing_period: 'monthly',
            source: 'plans_page',
          },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      check(
        await api.DELETE('/v1/me/plan/requests/{request_id}', {
          params: { path: { request_id: id } },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** Add-on packages on the subscription (0 removes). More units are charged now, prorated. */
export function useSetAddOn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: { key: string; quantity: number }) =>
      check(await api.PUT('/v1/me/plan/add-ons', { body })),
    onSuccess: invalidate,
  });
}

/** Billing off: ask staff for an add-on. */
export function useRequestAddOn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (key: string) =>
      check(
        await api.POST('/v1/me/plan/requests', {
          body: {
            kind: 'add_on',
            add_on_key: key,
            billing_period: 'monthly',
            source: 'plans_page',
          },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** Back to Grátis (at the end of the paid period with a subscription). */
export function useDowngrade() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => check(await api.POST('/v1/me/plan/downgrade')),
    onSuccess: invalidate,
  });
}

export function useResume() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => check(await api.POST('/v1/me/plan/resume')),
    onSuccess: invalidate,
  });
}

/** Stripe's billing portal: card, invoices. */
export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => check(await api.POST('/v1/me/plan/portal')),
    onSuccess: (out) => window.location.assign(out.url),
  });
}
