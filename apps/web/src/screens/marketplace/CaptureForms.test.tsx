import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, resetDb } from '@/lib/data/store';

import messages from '../../../messages/pt-BR.json';
import { readAuctionCriteria } from '@/lib/data/auction';

import { AuctionForm } from './AuctionForm';
import { DeveloperWaitlistForm } from './DeveloperWaitlistForm';
import { InstitutionalForm } from './InvestorForms';
import { OwnerListingForm, maskCep } from './OwnerListingForm';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push }),
}));

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

  it('auction keeps contact and marketing consents separate and shows criteria next', async () => {
    window.sessionStorage.clear();
    renderIt(<AuctionForm />);
    type('Seu nome', 'Júlia Prado');
    type('WhatsApp', '(11) 92740-8912');
    type('Cidades ou bairros', 'São Paulo · Zona Sul');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Casa' }));
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Aceito receber oportunidades de leilão pelo WhatsApp. Posso sair a qualquer momento.',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quero receber oportunidades' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/leilao/confirmado'));
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'auction',
      consents: { contact_about_properties: true, marketing: false },
      criteria: { regions: 'São Paulo · Zona Sul', property_kinds: ['house'], purpose: 'live' },
    });
    // Only criteria are kept for the confirmation page: no name or phone.
    expect(readAuctionCriteria()).not.toHaveProperty('name');
    expect(readAuctionCriteria()?.property_kinds).toEqual(['house']);
  });

  it('institutional pilot form requires at least one front', async () => {
    renderIt(<InstitutionalForm />);
    type('Seu nome', 'Rita Souza');
    type('Empresa', 'Gestora Exemplo');
    type('Cidades dos ativos', 'São Paulo');
    type('WhatsApp', '(11) 92740-8912');
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Aceito receber contato da Casvitta sobre o piloto.' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agendar conversa' }));
    expect(await screen.findByText('Escolha pelo menos uma frente.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Leasing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agendar conversa' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'investor_institutional',
      criteria: { org_type: 'fii_manager', portfolio_size: 'up_to_10', interests: ['leasing'] },
    });
  });
});
