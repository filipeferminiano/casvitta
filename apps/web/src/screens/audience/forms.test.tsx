import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, resetDb } from '@/lib/data/store';

import messages from '../../../messages/pt-BR.json';

import { AgencyDemoForm } from './AgencyDemoForm';
import { audienceFor } from './AudienceNav';
import { OwnerStartForm } from './OwnerStartForm';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const PACKS = [
  { key: '30d', days: 30, priceCents: 5_900 },
  { key: '90d', days: 90, priceCents: 14_900 },
] as const;

const renderIt = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('owner start form (kind owner_listing_start)', () => {
  beforeEach(() => {
    resetDb();
    window.history.replaceState(null, '', '/anunciar-imovel');
  });

  it('asks for the city before the contact step', () => {
    renderIt(<OwnerStartForm packs={[...PACKS]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anunciar meu imóvel' }));
    expect(
      screen.getByText('Informe a cidade do imóvel, por exemplo São Paulo, SP.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Seu WhatsApp')).not.toBeInTheDocument();
  });

  it('shows the lowest price from config and keeps the broker request reachable', () => {
    renderIt(<OwnerStartForm packs={[...PACKS]} />);
    expect(screen.getByText(/A partir de R\$\s59 por 30 dias/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prefiro a ajuda de um corretor' })).toHaveAttribute(
      'href',
      '/anunciar-imovel/corretor',
    );
  });

  it('requires consent and stores nothing without it', async () => {
    renderIt(<OwnerStartForm packs={[...PACKS]} />);
    type('Cidade', 'Campinas, SP');
    fireEvent.click(screen.getByRole('button', { name: 'Anunciar meu imóvel' }));
    type('Seu nome', 'Paulo Mendes');
    type('Seu WhatsApp', '(11) 92740-8912');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar no WhatsApp' }));
    expect(await screen.findByText(/Marque a autorização/)).toBeInTheDocument();
    expect(db().interestSignups).toHaveLength(0);
  });

  it('stores the start with the pack chosen on the page and confirms without charging', async () => {
    window.history.replaceState(null, '', '/anunciar-imovel#comece-90');
    renderIt(<OwnerStartForm packs={[...PACKS]} />);
    expect(await screen.findByText(/Período escolhido: 90 dias por R\$\s149/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Alugar' }));
    type('Cidade', 'Campinas, SP');
    fireEvent.click(screen.getByRole('button', { name: 'Anunciar meu imóvel' }));
    expect(screen.getByText('Alugar · Apartamento · Campinas, SP')).toBeInTheDocument();
    type('Seu nome', 'Paulo Mendes');
    type('Seu WhatsApp', '(11) 92740-8912');
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar no WhatsApp' }));
    });

    const status = await screen.findByRole('status');
    expect(within(status).getByText('Recebemos.')).toBeInTheDocument();
    expect(
      within(status).getByText('Vamos te chamar no WhatsApp para concluir o anúncio.'),
    ).toBeInTheDocument();
    expect(db().interestSignups).toHaveLength(1);
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'owner_listing_start',
      phone: '(11) 92740-8912',
      consents: { contact_about_properties: true, marketing: false },
      criteria: {
        transaction: 'rent',
        property_kind: 'apartment',
        city: 'Campinas, SP',
        period_days: 90,
      },
    });
  });
});

describe('agency demo form (kind agency_demo)', () => {
  beforeEach(() => resetDb());

  it('validates agency, team size, e-mail and consent before storing', async () => {
    renderIt(<AgencyDemoForm />);
    type('Seu nome', 'Carla Rocha');
    type('WhatsApp', '(11) 92740-8912');
    type('E-mail', 'carla');
    fireEvent.click(screen.getByRole('button', { name: 'Agendar demonstração' }));
    expect(await screen.findByText('Informe o nome da imobiliária.')).toBeInTheDocument();
    expect(screen.getByText('Escolha o tamanho da equipe.')).toBeInTheDocument();
    expect(
      screen.getByText('Confira o e-mail, por exemplo voce@imobiliaria.com.br.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(db().interestSignups).toHaveLength(0);
  });

  it('stores the demo request with its criteria and shows the success state', async () => {
    renderIt(<AgencyDemoForm />);
    type('Seu nome', 'Carla Rocha');
    type('Imobiliária', 'Imobiliária Sul');
    type('WhatsApp', '(11) 92740-8912');
    type('E-mail', 'carla@imobiliariasul.com.br');
    fireEvent.click(screen.getByRole('radio', { name: '6–15' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Agendar demonstração' }));
    });

    expect(await screen.findByText('Pedido de demonstração recebido')).toBeInTheDocument();
    expect(db().interestSignups).toHaveLength(1);
    expect(db().interestSignups[0]).toMatchObject({
      kind: 'agency_demo',
      email: 'carla@imobiliariasul.com.br',
      criteria: { company: 'Imobiliária Sul', team_size: '6_15', active_properties: 'up_to_200' },
    });
  });
});

describe('audience switch routing', () => {
  it('only the three audience pages get the switch', () => {
    expect(audienceFor('/anunciar-imovel')).toBe('owners');
    expect(audienceFor('/para-corretores')).toBe('brokers');
    expect(audienceFor('/para-imobiliarias')).toBe('agencies');
    expect(audienceFor('/anunciar-imovel/corretor')).toBeNull();
    expect(audienceFor('/comprar')).toBeNull();
  });
});
