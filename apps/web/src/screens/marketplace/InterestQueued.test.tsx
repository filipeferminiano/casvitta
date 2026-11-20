import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/pt-BR.json';

import { DeveloperWaitlistForm } from './DeveloperWaitlistForm';

// The API stored the signup but no WhatsApp adapter delivers yet.
vi.mock('@/lib/data/interest', () => ({
  submitInterest: vi.fn(async () => ({ ok: true, optIn: 'queued' })),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('capture form without WhatsApp delivery (rule 11)', () => {
  it('does not claim a message was sent', async () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <DeveloperWaitlistForm />
      </NextIntlClientProvider>,
    );
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type('Seu nome', 'Rita Souza');
    type('WhatsApp', '(11) 92740-8912');
    type('Empresa', 'Construtora Exemplo');
    type('Cidades dos lançamentos', 'São Paulo');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na lista' }));

    expect(await screen.findByText(messages.interest.queuedDescription)).toBeInTheDocument();
    expect(screen.queryByText(/Mandamos uma mensagem/)).not.toBeInTheDocument();
  });
});
