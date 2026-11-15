import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, resetDb } from '@/lib/data/store';

import messages from '../../../messages/pt-BR.json';
import { DeveloperWaitlistForm } from './DeveloperWaitlistForm';
import { OwnerListingForm, maskCep } from './OwnerListingForm';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const renderIt = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('capture forms store interest only (rule 11)', () => {
  beforeEach(() => resetDb());

  it('masks CEP as 00000-000', () => {
    expect(maskCep('04010100')).toBe('04010-100');
    expect(maskCep('0401')).toBe('0401');
  });

  it('owner request rejects a short CEP and stores nothing', async () => {
    renderIt(<OwnerListingForm />);
    type('CEP', '0401');
    type('Seu nome', 'Paulo Mendes');
    type('Seu WhatsApp', '(11) 92740-8912');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser contatado' }));
    expect(await screen.findByText('Confira o CEP: são 8 números.')).toBeInTheDocument();
    expect(db().interestSignups).toHaveLength(0);
  });

  it('owner request stores transaction, CEP and property facts', async () => {
    renderIt(<OwnerListingForm />);
    fireEvent.click(screen.getByRole('radio', { name: 'Alugar' }));
    type('CEP', '04010100');
    type('Quartos', '2');
    type('Área (m²)', '68');
    type('Seu nome', 'Paulo Mendes');
    type('Seu WhatsApp', '(11) 92740-8912');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser contatado' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'owner_listing',
      criteria: {
        transaction: 'rent',
        cep: '04010-100',
        property_kind: 'apartment',
        bedrooms: 2,
        area_m2: 68,
        expected_price_cents: null,
      },
    });
  });

  it('developer waitlist splits cities and requires the company', async () => {
    renderIt(<DeveloperWaitlistForm />);
    type('Seu nome', 'Rita Souza');
    type('WhatsApp', '(11) 92740-8912');
    type('Cidades dos lançamentos', 'São Paulo, Campinas');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na lista' }));
    expect(await screen.findByText('Escreva o nome da empresa.')).toBeInTheDocument();
    type('Empresa', 'Construtora Exemplo');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na lista' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'developer',
      criteria: { company: 'Construtora Exemplo', cities: ['São Paulo', 'Campinas'] },
    });
  });
});
