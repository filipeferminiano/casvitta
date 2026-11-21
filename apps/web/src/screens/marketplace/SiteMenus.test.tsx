import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/pt-BR.json';
import { buildMenus, type NavHood } from '@/lib/site-nav';

import { DesktopMenus, MobileMenus } from './SiteMenus';

// Radix NavigationMenu.Viewport measures its content; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const HOODS: NavHood[] = [
  { slug: 'vila-mariana', name: 'Vila Mariana', inName: 'na Vila Mariana' },
  { slug: 'moema', name: 'Moema', inName: 'em Moema' },
];

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

describe('site menus', () => {
  it('opens a desktop menu on click and closes it with Esc', async () => {
    const user = userEvent.setup();
    wrap(<DesktopMenus menus={buildMenus(HOODS)} />);
    const nav = screen.getByRole('navigation', { name: 'Navegação do site' });
    const buy = within(nav).getByRole('button', { name: 'Comprar' });
    expect(buy).toHaveAttribute('aria-expanded', 'false');
    await user.click(buy);
    expect(buy).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Apartamentos à venda' })).toHaveAttribute(
      'href',
      '/comprar?tipo=apartamento',
    );
    expect(screen.getByRole('link', { name: 'Vila Mariana' })).toHaveAttribute(
      'href',
      '/comprar?onde=Vila+Mariana',
    );
    expect(screen.getByText(/anúncios demonstrativos/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(buy).toHaveAttribute('aria-expanded', 'false');
  });

  it('names the tools menu "Ferramentas" and links the site map', async () => {
    const user = userEvent.setup();
    wrap(<DesktopMenus menus={buildMenus(HOODS)} />);
    await user.click(screen.getByRole('button', { name: 'Ferramentas' }));
    expect(screen.getByRole('link', { name: 'Calcular ITBI' })).toHaveAttribute(
      'href',
      '/itbi/sao-paulo',
    );
    expect(screen.getByRole('link', { name: /Mapa do site/ })).toHaveAttribute(
      'href',
      '/mapa-do-site',
    );
    expect(screen.queryByRole('button', { name: 'Preços' })).not.toBeInTheDocument();
  });

  it('mobile menu is an accordion and closes the drawer on navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    wrap(<MobileMenus menus={buildMenus(HOODS)} onNavigate={onNavigate} />);
    const rent = screen.getByRole('button', { name: 'Alugar' });
    expect(screen.queryByRole('link', { name: 'Casas para alugar' })).not.toBeInTheDocument();
    await user.click(rent);
    expect(rent).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('link', { name: 'Casas para alugar' }));
    expect(onNavigate).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Moema' })).toHaveAttribute(
      'href',
      '/alugar?onde=Moema',
    );
  });
});
