import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/pt-BR.json';
import { BottomTabs } from './BottomTabs';
import { bottomTabs, footerNav, moduleNav, primaryNav } from './nav-items';
import { SideNav } from './SideNav';

const segment = vi.hoisted(() => ({ current: 'leads' as string | null }));
vi.mock('next/navigation', () => ({ useSelectedLayoutSegment: () => segment.current }));

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe('Broker OS navigation', () => {
  it('lists every section in pt-BR, with Anúncios under Módulos and counters', async () => {
    wrap(<SideNav />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.querySelector('span')?.textContent);
    expect(labels).toEqual([
      'Início',
      'Imóveis',
      'Leads',
      'Conversas',
      'Agenda',
      'Propostas',
      'Anúncios',
      'Loja de módulos',
      'Configurações',
    ]);
    expect(within(nav).getByRole('heading', { name: 'Núcleo' })).toBeInTheDocument();
    expect(within(nav).getByRole('heading', { name: 'Módulos' })).toBeInTheDocument();
    expect(nav).not.toHaveTextContent('Ads Studio');
    await waitFor(() => expect(within(nav).getByText('4 novos')).toBeInTheDocument());
  });

  it('marks the current section with aria-current', () => {
    segment.current = 'leads';
    wrap(<SideNav />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: /^Leads/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /^Início/ })).not.toHaveAttribute('aria-current');
  });

  it('bottom tabs show Início, Leads, Conversas, Agenda, Anúncios', () => {
    segment.current = 'agenda';
    wrap(<BottomTabs />);
    const nav = screen.getByRole('navigation', { name: 'Navegação' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Início',
      'Leads',
      'Conversas',
      'Agenda',
      'Anúncios',
    ]);
    expect(within(nav).getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(links.map((l) => l.getAttribute('href'))).toEqual(
      bottomTabs.map((i) => `/${i.segment}`),
    );
  });

  it('has a page and copy for every nav item', async () => {
    const appMessages = messages.app as Record<string, Record<string, string>>;
    for (const item of [...primaryNav, ...moduleNav, ...footerNav]) {
      const page = await import(`../../app/(app)/app/${item.segment}/page.tsx`);
      expect(page.default).toBeTypeOf('function');
      expect(appMessages[item.labelKey]?.emptyTitle).toBeTruthy();
    }
  });
});
