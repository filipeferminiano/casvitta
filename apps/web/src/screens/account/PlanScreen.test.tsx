import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/pt-BR.json';
import type { PlanUsage } from '@/lib/data/plan';

import { PlanScreen } from './PlanScreen';

const state = vi.hoisted(() => ({
  usage: null as unknown,
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => state.params,
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/lib/data/plan', () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    usePlan: () => ({ isPending: false, isError: false, data: state.usage }),
    useCheckout: mutation,
    useRequestPlan: mutation,
    useCancelRequest: mutation,
    useDowngrade: mutation,
    useResume: mutation,
    useBillingPortal: mutation,
  };
});

const base: PlanUsage = {
  plan: 'free',
  legacy: false,
  billing_enabled: true,
  meters: [{ meter: 'active_properties', used: 4, limit: 5, state: 'warning' }],
  open_request: null,
  subscription: null,
};

const show = (usage: PlanUsage, query = '') => {
  state.usage = usage;
  state.params = new URLSearchParams(query);
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <PlanScreen />
    </NextIntlClientProvider>,
  );
};

describe('Plano e uso', () => {
  it('offers card checkout on Grátis, with usage and who bills media', () => {
    show(base);
    expect(screen.getByRole('button', { name: 'Assinar Automação' })).toBeInTheDocument();
    expect(screen.getByText('4 de 5')).toBeInTheDocument();
    expect(screen.getByText('Você já usou 80% do limite.')).toBeInTheDocument();
    expect(screen.getByText(/não vê nem guarda os dados do cartão/)).toBeInTheDocument();
    expect(screen.getByText(/cobrados por elas, direto na sua conta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerenciar pagamento' })).toBeNull();
  });

  it('shows the end of the paid period and lets the broker keep the plan', () => {
    show({
      ...base,
      plan: 'automation',
      subscription: {
        plan: 'automation',
        status: 'active',
        current_period_end: '2026-12-22T12:00:00Z',
        cancel_at_period_end: true,
        payment_failed: false,
      },
    });
    expect(screen.getByText(/Seu plano vale até 22\/12\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manter meu plano' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerenciar pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mudar para Pro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plano atual' })).toBeDisabled();
  });

  it('with billing off, a paid plan is a request to the Casvitta team', () => {
    show({ ...base, billing_enabled: false });
    expect(screen.getByRole('button', { name: 'Pedir Pro' })).toBeInTheDocument();
    expect(screen.getByText(/feita pela equipe da Casvitta/)).toBeInTheDocument();
  });

  it('back from Stripe: confirming, then cancelled without a charge', () => {
    show(
      {
        ...base,
        open_request: {
          id: 'r1',
          kind: 'plan',
          current_plan: 'free',
          requested_plan: 'automation',
          add_on_key: null,
          billing_period: 'monthly',
          source: 'plans_page',
          status: 'awaiting_payment',
          created_at: '2026-11-22T12:00:00Z',
          handled_at: null,
          reason: null,
        },
      },
      'pagamento=ok',
    );
    expect(screen.getByText(/estamos confirmando com a Stripe/)).toBeInTheDocument();
  });
});
