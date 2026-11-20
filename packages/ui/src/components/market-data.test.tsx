import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Breadcrumbs } from './Breadcrumbs.tsx';
import { LeadAlertForm, type LeadAlertFormLabels } from './LeadAlertForm.tsx';
import { MonthlySeriesChart } from './MonthlySeriesChart.tsx';
import { SourceNote } from './SourceNote.tsx';

describe('Breadcrumbs', () => {
  it('links the parents and marks the last item as the current page', () => {
    render(
      <Breadcrumbs
        label="Você está em"
        items={[
          { label: 'São Paulo', href: '/preco-m2/sao-paulo' },
          { label: 'Vila Mariana', href: '/preco-m2/sao-paulo/vila-mariana' },
          { label: 'Rua Exemplo' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(within(nav).getByText('Rua Exemplo')).toHaveAttribute('aria-current', 'page');
  });
});

describe('MonthlySeriesChart', () => {
  const props = {
    formatValue: (v: number) => `R$ ${v}`,
    formatMonth: (m: string) => m,
    title: 'Mediana por mês',
    countLabel: 'Vendas',
    valueLabel: 'Mediana',
    monthLabel: 'Mês',
  };

  it('has an accessible table with one row per month and a dash for gaps', () => {
    render(
      <MonthlySeriesChart
        {...props}
        points={[
          { month: '2026-01', value: 10000, count: 40 },
          { month: '2026-02', value: null, count: 3 },
          { month: '2026-03', value: 10200, count: 38 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Mediana por mês' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3 months
    expect(within(rows[2]!).getByText('—')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('R$ 10000')).toBeInTheDocument();
  });

  it('renders only the caption when there are no points', () => {
    render(<MonthlySeriesChart {...props} points={[]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Mediana por mês')).toBeInTheDocument();
  });
});

describe('SourceNote', () => {
  it('joins source, update date and extra items', () => {
    const { container } = render(
      <SourceNote source="Fonte: X" updated="Atualizado em 05/11/2026" items={['12 meses']} />,
    );
    expect(container.textContent).toBe('Fonte: X · Atualizado em 05/11/2026 · 12 meses');
  });
});

const labels: LeadAlertFormLabels = {
  title: 'Avise-me',
  name: 'Nome',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  emailOptional: '(opcional)',
  intentLabel: 'Você quer',
  intentBuy: 'Comprar',
  intentOwner: 'Tenho um imóvel aqui',
  consentContact: 'Aceito receber contato sobre imóveis',
  consentMarketing: 'Aceito receber novidades',
  consentRequired: 'Marque para podermos avisar você.',
  honeypot: 'Não preencha',
  submit: 'Quero ser avisado',
  submitting: 'Enviando…',
  successTitle: 'Pronto, vamos avisar você.',
  successDescription: 'Mandamos mensagem no WhatsApp.',
  errorTitle: 'Não conseguimos enviar',
};

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome'), 'Maria');
  await user.type(screen.getByLabelText('WhatsApp'), '11927408912');
}

describe('LeadAlertForm', () => {
  it('starts with both consents unchecked and blocks submit without contact consent', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LeadAlertForm labels={labels} onSubmit={onSubmit} />);
    expect(screen.getByRole('checkbox', { name: labels.consentContact })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: labels.consentMarketing })).not.toBeChecked();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Quero ser avisado' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(labels.consentRequired)).toBeInTheDocument();
  });

  it('sends the values (honeypot included) and shows success', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    const { container } = render(
      <LeadAlertForm labels={labels} defaultIntent="owner" onSubmit={onSubmit} />,
    );
    await fill(user);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    await user.type(honeypot, 'bot');
    await user.click(screen.getByRole('checkbox', { name: labels.consentContact }));
    await user.click(screen.getByRole('button', { name: 'Quero ser avisado' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Maria',
      whatsapp: '11927408912',
      email: '',
      intent: 'owner',
      consentContact: true,
      consentMarketing: false,
      website: 'bot',
    });
    expect(await screen.findByText(labels.successTitle)).toBeInTheDocument();
  });

  it('shows the server message and field errors after a failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      message: 'Confira o WhatsApp.',
      fieldErrors: { whatsapp: 'Use DDD + número.' },
    });
    render(<LeadAlertForm labels={labels} onSubmit={onSubmit} />);
    await fill(user);
    await user.click(screen.getByRole('checkbox', { name: labels.consentContact }));
    await user.click(screen.getByRole('button', { name: 'Quero ser avisado' }));
    expect(await screen.findByText('Confira o WhatsApp.')).toBeInTheDocument();
    expect(screen.getByText('Use DDD + número.')).toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp')).toHaveAttribute('aria-invalid', 'true');
  });
});
