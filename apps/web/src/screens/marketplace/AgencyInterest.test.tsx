import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, resetDb } from '@/lib/data/store';

import messages from '../../../messages/pt-BR.json';
import { AgencyInterest } from './AgencyInterest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('utm_source=instagram'),
}));

// Radix Checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const renderIt = () =>
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AgencyInterest />
    </NextIntlClientProvider>,
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Agency OS waitlist (capture only, rule 11)', () => {
  beforeEach(() => resetDb());

  it('requires the contact consent before storing anything', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser avisado do Agency OS' }));
    type('Imobiliária', 'Prado Imóveis');
    type('Seu nome', 'Camila Prado');
    type('WhatsApp', '(11) 92740-8912');
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser avisado' }));
    expect(
      await screen.findByText('Marque a autorização para podermos falar com você.'),
    ).toBeInTheDocument();
    expect(db().interestSignups).toHaveLength(0);
  });

  it('stores an agency signup with criteria, consents and UTM', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser avisado do Agency OS' }));
    type('Imobiliária', 'Prado Imóveis');
    type('Quantos corretores (opcional)', '8');
    type('Seu nome', 'Camila Prado');
    type('WhatsApp', '(11) 92740-8912');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser avisado' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'agency',
      criteria: { company: 'Prado Imóveis', brokers_count: 8, city: null },
      consents: { contact_about_properties: true, marketing: false },
      utm: { source: 'instagram' },
      status: 'pending_opt_in',
    });
  });
});
